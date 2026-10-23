import fs from 'node:fs';
import ApkReader from '@devicefarmer/adbkit-apkreader';

export interface ExtractedApkMetadata {
  packageId: string;
  versionCode: number;
  versionName: string;
  minSdkVersion: number;
  targetSdkVersion: number;
  appName?: string;
}

export class ApkValidationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'APK_VALIDATION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ApkValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ApkService {
  public static readonly EXPECTED_PACKAGE_ID = 'in.chandilservices.app';

  /**
   * Opens an APK file from disk, parses its binary AndroidManifest.xml,
   * and verifies required metadata, including package ID.
   */
  public async parseAndValidateApk(filePath: string): Promise<ExtractedApkMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new ApkValidationError('APK file does not exist on disk.', 'FILE_NOT_FOUND', 404);
    }

    let reader: any;
    try {
      reader = await ApkReader.open(filePath);
    } catch (err: any) {
      throw new ApkValidationError(
        `Failed to parse file as an Android APK archive: ${err.message}`,
        'INVALID_APK_ARCHIVE',
        400
      );
    }

    let manifest: any;
    try {
      manifest = await reader.readManifest();
    } catch (err: any) {
      throw new ApkValidationError(
        `Failed to decode binary AndroidManifest.xml: ${err.message}`,
        'INVALID_MANIFEST',
        400
      );
    }

    if (!manifest || typeof manifest !== 'object') {
      throw new ApkValidationError('Manifest could not be decoded from APK.', 'INVALID_MANIFEST', 400);
    }

    // 1. Verify Package Identifier
    const packageId = manifest.package;
    if (!packageId || typeof packageId !== 'string') {
      throw new ApkValidationError(
        'APK AndroidManifest.xml is missing a valid package attribute.',
        'MISSING_PACKAGE_ID',
        400
      );
    }

    if (packageId !== ApkService.EXPECTED_PACKAGE_ID) {
      throw new ApkValidationError(
        `Invalid package identifier "${packageId}". Expected "${ApkService.EXPECTED_PACKAGE_ID}".`,
        'WRONG_PACKAGE_ID',
        400
      );
    }

    // 2. Verify Android versionCode
    const rawVersionCode = manifest.versionCode;
    const versionCode = Number(rawVersionCode);
    if (!Number.isInteger(versionCode) || versionCode <= 0) {
      throw new ApkValidationError(
        `Invalid Android versionCode "${rawVersionCode}". Must be a positive integer.`,
        'INVALID_VERSION_CODE',
        400
      );
    }

    // 3. Verify Android versionName
    const versionName = manifest.versionName ? String(manifest.versionName).trim() : '';
    if (!versionName) {
      throw new ApkValidationError(
        'APK AndroidManifest.xml is missing a valid versionName string.',
        'MISSING_VERSION_NAME',
        400
      );
    }

    // 4. Extract SDK levels (with sane fallbacks for Android)
    const minSdkVersion = Number(manifest.usesSdk?.minSdkVersion) || 22;
    const targetSdkVersion = Number(manifest.usesSdk?.targetSdkVersion) || 34;

    return {
      packageId,
      versionCode,
      versionName,
      minSdkVersion,
      targetSdkVersion,
      appName: manifest.application?.label,
    };
  }
}

export const apkService = new ApkService();
