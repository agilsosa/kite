import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import type { MakerRpmConfigOptions } from '@electron-forge/maker-rpm';
import { PublisherGitHub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { GITHUB_REPOSITORY } from './src/shared/release';

const linuxIcon = path.join(__dirname, 'build', 'icon.png');

// `electron-installer-redhat` does not expose `specTemplate` or
// `desktopTemplate` in its Forge option types, but the underlying installer
// accepts both. The desktop template drops an upstream duplicate
// `StartupWMClass` line.
const rpmOptions: MakerRpmConfigOptions & {
  specTemplate: string;
  desktopTemplate: string;
} = {
  name: 'kite',
  genericName: 'Lanzador infantil',
  license: 'MIT',
  homepage: 'https://github.com/agilsosa/kite',
  icon: linuxIcon,
  categories: ['Utility'],
  specTemplate: path.join(__dirname, 'build', 'rpm.spec.ejs'),
  desktopTemplate: path.join(__dirname, 'build', 'rpm.desktop.ejs'),
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // easy-volume's Windows helper has to run as a child process, and files
    // inside an asar archive cannot be executed.
    extraResource: [
      'node_modules/easy-volume/dist/platforms/windows/volume.exe',
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({
      options: rpmOptions,
    }),
    new MakerDeb({
      options: {
        name: 'kite',
        genericName: 'Lanzador infantil',
        maintainer: 'Agil Sosa <agilsosa@users.noreply.github.com>',
        homepage: 'https://github.com/agilsosa/kite',
        icon: linuxIcon,
        categories: ['Utility'],
        // Runtime tools used by the volume and Wi-Fi popovers. They are
        // recommended rather than required so Kite still installs on a plain
        // system and reports the feature as unavailable.
        recommends: ['alsa-utils', 'network-manager'],
      },
    }),
  ],
  publishers: [
    new PublisherGitHub({
      repository: GITHUB_REPOSITORY,
      draft: false,
      prerelease: false,
      tagPrefix: 'v',
    }),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/preload/child.ts',
          config: 'vite.preload.child.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
