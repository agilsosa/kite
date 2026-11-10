import {
  buildSyncPayload,
  createEmptyProfileDraft,
  documentToDraft,
  parseFeaturesJson,
  validateProfileDraft,
} from '../shared/profile';
import type {
  ProfileApp,
  ProfileDocument,
  ProfileDraft,
  SyncPayload,
} from '../shared/profile';

/**
 * The editor keeps the advanced features as raw JSON text so an invalid draft
 * is never silently replaced by the last valid value. The text is parsed when
 * the preview or the save request is built.
 */
export interface EditorState {
  childName: string;
  volumeCap: number;
  allowedOrigins: string[];
  allowedApps: ProfileApp[];
  featuresText: string;
}

function copyApps(apps: ProfileApp[]): ProfileApp[] {
  return apps.map((app) => ({
    ...app,
    paths: { ...app.paths },
    args: [...app.args],
  }));
}

export function editorFromDocument(
  document: ProfileDocument | null,
): EditorState {
  const draft = document
    ? documentToDraft(document)
    : createEmptyProfileDraft();

  return {
    childName: draft.childName,
    volumeCap: draft.volumeCap,
    allowedOrigins: [...draft.allowedOrigins],
    allowedApps: copyApps(draft.allowedApps),
    featuresText: draft.features ? JSON.stringify(draft.features, null, 2) : '',
  };
}

export function editorToDraft(editor: EditorState): ProfileDraft {
  return {
    childName: editor.childName,
    volumeCap: editor.volumeCap,
    allowedOrigins: [...editor.allowedOrigins],
    allowedApps: copyApps(editor.allowedApps),
    features: parseFeaturesJson(editor.featuresText),
  };
}

export function buildPreview(
  editor: EditorState,
  revision: string,
): SyncPayload | null {
  try {
    return buildSyncPayload(
      validateProfileDraft(editorToDraft(editor)),
      revision,
    );
  } catch {
    return null;
  }
}
