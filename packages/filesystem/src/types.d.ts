// Optional peer dependencies — declared as modules so TypeScript doesn't error
// when they're dynamically imported but not installed.
declare module '@aws-sdk/client-s3' { const x: any; export = x; export default x; }
declare module '@aws-sdk/s3-request-presigner' { const x: any; export = x; export default x; }
declare module '@google-cloud/storage' { const x: any; export = x; export default x; }
declare module '@azure/storage-blob' { const x: any; export = x; export default x; }
declare module 'basic-ftp' { const x: any; export = x; export default x; }
declare module 'ssh2-sftp-client' { const x: any; export = x; export default x; }
