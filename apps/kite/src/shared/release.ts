/**
 * GitHub repository that hosts Kite's releases.
 *
 * The repository must be **public**: `update.electronjs.org` reads its
 * published releases to build the update feed, and the service does not
 * authenticate against private repositories.
 *
 * Change these two values (and the `repository` field in `package.json`) if
 * the project moves to a different owner or name.
 */
export const GITHUB_REPOSITORY = {
  owner: 'agilsosa',
  name: 'kite',
} as const;

export const UPDATE_FEED_ORIGIN = 'https://update.electronjs.org';
