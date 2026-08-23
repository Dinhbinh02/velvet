import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  outDir: 'dist',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss() as any],
    build: {
      target: 'esnext',
    },
    esbuild: {
      target: 'esnext',
      supported: {
        'top-level-await': true,
      },
    },
  }),
  manifest: {
    name: 'Velvet - Ebook Reader',
    description: 'A smooth, luxury Ebook reader extension for Google Chrome.',
    version: '1.0.0',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArG6PaV9sXa04ETGg+61Hu4kkXuafkHpMIDV5VN1O2zChrDkmBuIkFzd6DasQNEknudmFY2kgqb5UHXJ5XbVetFfdw886NW1Wc9Dm41oV0TBWhGp1oJ30Z3rF67AfQKti+PdZxNYsvSsmRBa6zsFKbPSol+YptFeWhB470NSqBzk3j3vYXGZAx3UDy6yUUCe9XncyT5bK2nrA5JY3GqnJ/TeloL6yS1b4Fp7N6Ki+qJKYV1NHA24qdJMkCvcc7iUPyOELNl5O5fWqMdJMudfmoUvcfuMItwG8SHZoVhS5EKQ6x+arZV7H2t6gC2SUxkV6FoRis5VOMfV3EJC3r73mcQIDAQAB',
    oauth2: {
      client_id: '824888142961-qo2d2j9an9eeu07mmvg15qbb51cdi3n2.apps.googleusercontent.com',
      scopes: [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
    permissions: [
      'storage',
      'unlimitedStorage',
      'sidePanel',
      'contextMenus',
      'scripting',
      'identity',
    ],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    action: {
      default_title: 'Mở Velvet Ebook Reader',
      default_icon: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
    },
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    web_accessible_resources: [
      {
        resources: [
          'book-content.css',
          'fonts/*',
          'workers/*',
          'icons/*',
        ],
        matches: ['<all_urls>'],
      },
    ],
  },
});
