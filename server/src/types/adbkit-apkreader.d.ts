declare module '@devicefarmer/adbkit-apkreader' {
  export interface ApkManifest {
    package: string;
    versionCode: number;
    versionName: string;
    usesSdk?: {
      minSdkVersion?: number;
      targetSdkVersion?: number;
    };
    [key: string]: any;
  }

  export interface ApkReader {
    readManifest(): Promise<ApkManifest>;
    [key: string]: any;
  }

  const ApkReader: {
    open(path: string): Promise<ApkReader>;
  };

  export default ApkReader;
}
