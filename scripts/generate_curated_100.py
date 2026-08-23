import urllib.request
import json
import time
import os
import re

COLLECTIONS_CONFIG = [
    {
        'id': 'fiction-literature',
        'title': 'Fiction & Literature',
        'subtitle': 'Great world novels, quintessential romances, and enduring prose',
        'description': 'Immortal works of deep human insight, profound love, and epochal drama from Jane Austen, F. Scott Fitzgerald, Charles Dickens, and Leo Tolstoy.',
        'subjects': ['classic_literature', 'historical_fiction', 'novels'],
        'category': 'fiction',
    },
    {
        'id': 'mysteries-thrillers',
        'title': 'Mysteries & Thrillers',
        'subtitle': 'Classic detective deductions, gothic suspense, and psychological thrillers',
        'description': 'Iconic detective mysteries, gothic thrillers, and suspense masterpieces from Arthur Conan Doyle, Bram Stoker, Mary Shelley, and Edgar Allan Poe.',
        'subjects': ['detective_and_mystery_stories', 'gothic_fiction', 'thriller'],
        'category': 'fiction',
    },
    {
        'id': 'scifi-fantasy',
        'title': 'Sci-Fi & Fantasy',
        'subtitle': 'Time travel, otherworldly expeditions, and cosmic visionary tales',
        'description': 'Pioneering science fiction, space adventures, and lost world expeditions by H.G. Wells, Jules Verne, and visionary early masters.',
        'subjects': ['science_fiction', 'fantasy_fiction', 'space_exploration'],
        'category': 'fiction',
    },
    {
        'id': 'philosophy-thought',
        'title': 'Philosophy & Thought',
        'subtitle': 'Stoic reflections, moral inquiries, and timeless wisdom of the mind',
        'description': 'Foundational texts of Stoic philosophy, existential inquiry, and timeless wisdom from Marcus Aurelius, Seneca, Plato, and Friedrich Nietzsche.',
        'subjects': ['philosophy', 'ethics', 'thought', 'stoicism'],
        'category': 'nonfiction',
    },
    {
        'id': 'history-politics',
        'title': 'History & Politics',
        'subtitle': 'Statecraft, leadership treatises, and the forces that shaped nations',
        'description': 'Master treatises on warfare, political dominion, and governance that have guided generals, emperors, and statesmen throughout history.',
        'subjects': ['politics_and_government', 'military_history', 'history', 'statesmanship'],
        'category': 'nonfiction',
    },
    {
        'id': 'biographies-memoirs',
        'title': 'Biographies & Memoirs',
        'subtitle': 'Journeys, notebooks, and confessions of extraordinary minds',
        'description': 'Personal memoirs, self-written confessions, and notebooks from Benjamin Franklin, Nikola Tesla, and legendary historical figures.',
        'subjects': ['autobiography', 'biography', 'memoirs', 'personal_narratives'],
        'category': 'nonfiction',
    },
    {
        'id': 'science-nature',
        'title': 'Science & Nature',
        'subtitle': 'The laws of nature, evolution, cosmology, and the universe',
        'description': 'Groundbreaking works on evolution, physics, electricity, and human knowledge from Charles Darwin, Albert Einstein, and pioneering scientists.',
        'subjects': ['science', 'natural_history', 'physics', 'astronomy', 'evolution'],
        'category': 'nonfiction',
    },
    {
        'id': 'poetry-drama',
        'title': 'Poetry, Drama & Performing Arts',
        'subtitle': 'Immortal tragedies, Shakespearean drama, and epic mythologies',
        'description': 'Homeric epics, Shakespearean tragedies, and enchanting fairy tales that have captivated the imagination of generations.',
        'subjects': ['drama', 'poetry', 'mythology', 'plays'],
        'category': 'fiction',
    }
]

def normalize_title(title):
    t = title.lower().strip()
    t = re.sub(r'[^a-z0-9\s]', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t

def fetch_subject_page(subject, offset):
    url = f'https://openlibrary.org/subjects/{subject}.json?limit=50&offset={offset}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'VelvetReader/1.0 (Public Domain Catalog)'})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.loads(res.read().decode())
            return data.get('works', [])
    except Exception as e:
        print(f'Error fetching {subject} offset {offset}: {e}')
        return []

def main():
    print("Generating strictly deduplicated collections (100 unique books each)...")
    global_seen_titles = set()
    collections_data = []

    for col in COLLECTIONS_CONFIG:
        print(f"\nCurating '{col['title']}'...")
        col_books = []
        
        for subj in col['subjects']:
            if len(col_books) >= 100:
                break
                
            for offset in [0, 50, 100, 150]:
                if len(col_books) >= 100:
                    break
                    
                works = fetch_subject_page(subj, offset)
                if not works:
                    continue
                    
                for w in works:
                    title = w.get('title', '').strip()
                    if not title:
                        continue
                        
                    norm_title = normalize_title(title)
                    if norm_title in global_seen_titles or len(norm_title) < 2:
                        continue
                        
                    # Add to global set to prevent appearing in any other collection
                    global_seen_titles.add(norm_title)
                    
                    author = 'Unknown Author'
                    if w.get('authors'):
                        author = ', '.join([a.get('name', '') for a in w.get('authors') if a.get('name')])
                        
                    cover_id = w.get('cover_id')
                    if cover_id:
                        cover_url = f'https://covers.openlibrary.org/b/id/{cover_id}-M.jpg'
                    else:
                        cover_url = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'
                        
                    ia_id = w.get('ia')
                    is_public = bool(
                        ia_id and
                        w.get('availability', {}).get('status') == 'open' and
                        not w.get('availability', {}).get('is_lendable') and
                        not w.get('availability', {}).get('is_printdisabled')
                    )
                    
                    epub_url = f'https://archive.org/download/{ia_id}/{ia_id}.epub' if (is_public and ia_id) else None
                    work_key = w.get('key', '').replace('/works/', '')
                    subjects = [s for s in w.get('subject', []) if isinstance(s, str)][:4]
                    
                    book = {
                        'id': f'ol-{work_key or len(global_seen_titles)}',
                        'workKey': work_key,
                        'title': title,
                        'author': author,
                        'coverUrl': cover_url,
                        'epubUrl': epub_url,
                        'subjects': subjects,
                        'publishYear': w.get('first_publish_year'),
                        'category': col['category'],
                        'source': 'Open Library',
                        'isPublicDomain': is_public
                    }
                    
                    col_books.append(book)
                    if len(col_books) >= 100:
                        break
                        
                time.sleep(0.15)
                
        print(f"✓ '{col['title']}': {len(col_books)} unique books")
        collections_data.append({
            'id': col['id'],
            'title': col['title'],
            'subtitle': col['subtitle'],
            'description': col['description'],
            'books': col_books
        })

    out_path = '/Users/dinhbinh/Documents/Projects/Velvet/src/data/curated_collections_100.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(collections_data, f, ensure_ascii=False, indent=2)

    total_books = sum(len(c['books']) for c in collections_data)
    print(f"\n🎉 Successfully wrote {len(collections_data)} collections with {total_books} globally unique books to {out_path}!")

if __name__ == '__main__':
    main()
