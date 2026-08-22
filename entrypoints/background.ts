import { WebToEpubService } from '@/src/services/webToEpubService';
import { BookService } from '@/src/services/bookService';

export default defineBackground(() => {
  // 1. Initialize Context Menus
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'velvet-open-reader',
      title: '📖 Open Velvet EPUB Reader',
      contexts: ['action'],
    });

    chrome.contextMenus.create({
      id: 'velvet-open-sidepanel',
      title: '📑 Open Velvet Side Panel',
      contexts: ['action'],
    });

    chrome.contextMenus.create({
      id: 'velvet-save-article',
      title: '✨ Save Article to Velvet Reader',
      contexts: ['page', 'selection'],
    });

    chrome.contextMenus.create({
      id: 'velvet-intercept-link',
      title: '📥 Open this EPUB in Velvet',
      contexts: ['link'],
      targetUrlPatterns: ['*://*/*.epub*', '*://*/*.EPUB*'],
    });
  });

  // 2. Handle Context Menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'velvet-open-reader') {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
    } else if (info.menuItemId === 'velvet-open-sidepanel' && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    } else if (info.menuItemId === 'velvet-intercept-link' && info.linkUrl) {
      try {
        const response = await fetch(info.linkUrl);
        const blob = await response.blob();
        const fileName = info.linkUrl.split('/').pop()?.split('?')[0] || 'book.epub';
        const file = new File([blob], fileName, { type: 'application/epub+zip' });
        const bookId = await BookService.importBook(file);
        chrome.tabs.create({ url: chrome.runtime.getURL(`reader.html?bookId=${bookId}`) });
      } catch (e) {
        console.error('Failed to import EPUB link:', e);
      }
    } else if (info.menuItemId === 'velvet-save-article' && tab?.id) {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const title = document.title || 'Web Article';
            const author = (document.querySelector('meta[name="author"]') as HTMLMetaElement)?.content || location.hostname;
            const content = document.querySelector('article')?.innerHTML || document.body.innerHTML;
            return { title, author, content, url: location.href };
          },
        });

        if (result) {
          const bookId = await WebToEpubService.convertAndSaveArticle(
            result.title,
            result.author,
            result.content,
            result.url
          );
          chrome.tabs.create({ url: chrome.runtime.getURL(`reader.html?bookId=${bookId}`) });
        }
      } catch (err) {
        console.error('Failed to save article into Velvet:', err);
      }
    }
  });

  // 3. Open Velvet Reader page directly when clicking the extension icon
  chrome.action.onClicked.addListener(async () => {
    const readerUrl = chrome.runtime.getURL('reader.html');
    const tabs = await chrome.tabs.query({ url: `${readerUrl}*` });
    if (tabs.length > 0 && tabs[0].id) {
      // Focus existing Velvet reader tab if already open
      chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      // Open new Velvet reader tab
      chrome.tabs.create({ url: readerUrl });
    }
  });

  // 4. Set panel behavior
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
});
