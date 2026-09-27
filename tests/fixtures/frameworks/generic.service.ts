declare class FileStore {
  save(value: unknown): unknown;
}

export class SettingsService {
  constructor(private readonly fileStore: FileStore) {}

  saveSettings(value: unknown) {
    return this.fileStore.save(value);
  }
}
