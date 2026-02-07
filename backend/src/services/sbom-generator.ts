/**
 * SBOM Generator Service
 * Feature #268: SBOM generation in CycloneDX and SPDX formats
 *
 * Generates Software Bill of Materials (SBOM) from project dependencies.
 * Uses @cyclonedx/cyclonedx-npm for CycloneDX format and converts to SPDX.
 * Supports JSON output format.
 * Storage: MinIO when available, local filesystem fallback.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client as MinioClient } from 'minio';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface SbomComponent {
  type: string;
  name: string;
  version: string;
  purl: string;
  license: string | null;
  scope: 'required' | 'optional' | 'excluded';
  description?: string;
  hashes?: Array<{ alg: string; content: string }>;
  externalReferences?: Array<{ type: string; url: string }>;
}

export interface SbomMetadata {
  timestamp: string;
  tools: Array<{ vendor: string; name: string; version: string }>;
  component: {
    type: string;
    name: string;
    version: string;
    description?: string;
  };
  authors?: Array<{ name: string; email?: string }>;
}

export interface CycloneDxSbom {
  bomFormat: 'CycloneDX';
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: SbomMetadata;
  components: Array<{
    type: string;
    name: string;
    version: string;
    purl?: string;
    licenses?: Array<{ license: { id?: string; name?: string } }>;
    scope?: string;
    hashes?: Array<{ alg: string; content: string }>;
    externalReferences?: Array<{ type: string; url: string }>;
  }>;
  dependencies?: Array<{
    ref: string;
    dependsOn: string[];
  }>;
}

export interface SpdxSbom {
  spdxVersion: string;
  dataLicense: string;
  SPDXID: string;
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: string[];
    licenseListVersion?: string;
  };
  packages: Array<{
    SPDXID: string;
    name: string;
    versionInfo: string;
    downloadLocation: string;
    filesAnalyzed: boolean;
    licenseConcluded: string;
    licenseDeclared: string;
    copyrightText?: string;
    externalRefs?: Array<{
      referenceCategory: string;
      referenceType: string;
      referenceLocator: string;
    }>;
    checksums?: Array<{
      algorithm: string;
      checksumValue: string;
    }>;
  }>;
  relationships?: Array<{
    spdxElementId: string;
    relatedSpdxElement: string;
    relationshipType: string;
  }>;
}

export interface SbomGenerationResult {
  sbom_id: string;
  project_id: string;
  project_name: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  summary: {
    total_components: number;
    production_components: number;
    dev_components: number;
    unique_licenses: number;
    license_distribution: Record<string, number>;
  };
  download: {
    url: string;
    filename: string;
    content_type: string;
    size_bytes: number;
  };
  sbom: CycloneDxSbom | SpdxSbom;
  storage: {
    location: 'minio' | 'local' | 'memory';
    bucket?: string;
    key?: string;
    path?: string;
  };
  compliance: {
    executive_order_14028: boolean;
    ntia_minimum_elements: boolean;
    missing_elements: string[];
  };
}

export interface StoredSbom {
  id: string;
  project_id: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  generated_at: string;
  generated_by: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_location: 'minio' | 'local' | 'memory';
  storage_path: string;
  component_count: number;
  license_distribution: Record<string, number>;
}

// ============================================================================
// MinIO Client
// ============================================================================

let minioClient: MinioClient | null = null;
const SBOM_BUCKET = 'sbom-storage';

function getMinioClient(): MinioClient | null {
  if (minioClient) return minioClient;

  const endpoint = process.env.STORAGE_ENDPOINT;
  const port = process.env.STORAGE_PORT;
  const accessKey = process.env.STORAGE_ACCESS_KEY;
  const secretKey = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !accessKey || !secretKey) {
    console.log('[SBOM] MinIO not configured - using local storage fallback');
    return null;
  }

  try {
    minioClient = new MinioClient({
      endPoint: endpoint,
      port: parseInt(port || '9000', 10),
      useSSL: process.env.STORAGE_USE_SSL === 'true',
      accessKey,
      secretKey,
    });
    console.log('[SBOM] MinIO client initialized');
    return minioClient;
  } catch (error) {
    console.error('[SBOM] Failed to initialize MinIO client:', error);
    return null;
  }
}

async function ensureBucketExists(): Promise<boolean> {
  const client = getMinioClient();
  if (!client) return false;

  try {
    const exists = await client.bucketExists(SBOM_BUCKET);
    if (!exists) {
      await client.makeBucket(SBOM_BUCKET, 'us-east-1');
      console.log(`[SBOM] Created bucket: ${SBOM_BUCKET}`);
    }
    return true;
  } catch (error) {
    console.error('[SBOM] Failed to ensure bucket exists:', error);
    return false;
  }
}

// ============================================================================
// In-Memory Storage (for when MinIO and local filesystem are unavailable)
// ============================================================================

const inMemorySbomStore = new Map<string, { content: string; metadata: StoredSbom }>();

// ============================================================================
// Local Storage Paths
// ============================================================================

const LOCAL_SBOM_DIR = path.join(process.cwd(), 'data', 'sbom');

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_SBOM_DIR)) {
    fs.mkdirSync(LOCAL_SBOM_DIR, { recursive: true });
  }
}

// ============================================================================
// SBOM Index (tracks all generated SBOMs)
// ============================================================================

const sbomIndex = new Map<string, StoredSbom>();

export function getSbomById(sbomId: string): StoredSbom | undefined {
  return sbomIndex.get(sbomId);
}

export function listSbomsByProject(projectId: string): StoredSbom[] {
  const result: StoredSbom[] = [];
  sbomIndex.forEach((sbom) => {
    if (sbom.project_id === projectId) {
      result.push(sbom);
    }
  });
  return result.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
}

// ============================================================================
// CycloneDX Generation using @cyclonedx/cyclonedx-npm CLI
// ============================================================================

async function generateCycloneDxFromNpm(projectPath: string, includeDevDeps: boolean): Promise<CycloneDxSbom> {
  const outputPath = path.join('/tmp', `sbom-${Date.now()}.json`);

  try {
    // Build the cyclonedx-npm command
    const devFlag = includeDevDeps ? '' : '--omit dev';
    const command = `npx @cyclonedx/cyclonedx-npm --output-file "${outputPath}" --spec-version 1.5 ${devFlag}`.trim();

    // Execute in the project directory
    await execAsync(command, {
      cwd: projectPath,
      timeout: 60000, // 60 second timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large projects
    });

    // Read the generated SBOM
    const sbomContent = fs.readFileSync(outputPath, 'utf-8');
    const sbom = JSON.parse(sbomContent) as CycloneDxSbom;

    // Clean up temp file
    fs.unlinkSync(outputPath);

    return sbom;
  } catch (error: any) {
    // Clean up temp file if it exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.error('[SBOM] CycloneDX generation failed:', error.message);

    // Fall back to reading package.json directly
    return await generateCycloneDxFromPackageJson(projectPath, includeDevDeps);
  }
}

/**
 * Fallback: Generate CycloneDX from package.json and package-lock.json
 */
async function generateCycloneDxFromPackageJson(projectPath: string, includeDevDeps: boolean): Promise<CycloneDxSbom> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageLockPath = path.join(projectPath, 'package-lock.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  let lockFile: any = null;

  if (fs.existsSync(packageLockPath)) {
    lockFile = JSON.parse(fs.readFileSync(packageLockPath, 'utf-8'));
  }

  const sbomId = `urn:uuid:${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  const components: CycloneDxSbom['components'] = [];

  // Process production dependencies
  const prodDeps = packageJson.dependencies || {};
  for (const [name, versionSpec] of Object.entries(prodDeps)) {
    const resolvedVersion = lockFile?.packages?.[`node_modules/${name}`]?.version ||
                           lockFile?.dependencies?.[name]?.version ||
                           (versionSpec as string).replace(/^[\^~]/, '');

    const license = lockFile?.packages?.[`node_modules/${name}`]?.license || 'UNKNOWN';

    components.push({
      type: 'library',
      name,
      version: resolvedVersion,
      purl: `pkg:npm/${name.startsWith('@') ? name.replace('/', '%2F') : name}@${resolvedVersion}`,
      licenses: [{ license: { id: license } }],
      scope: 'required',
    });
  }

  // Process dev dependencies if requested
  if (includeDevDeps) {
    const devDeps = packageJson.devDependencies || {};
    for (const [name, versionSpec] of Object.entries(devDeps)) {
      const resolvedVersion = lockFile?.packages?.[`node_modules/${name}`]?.version ||
                             lockFile?.dependencies?.[name]?.version ||
                             (versionSpec as string).replace(/^[\^~]/, '');

      const license = lockFile?.packages?.[`node_modules/${name}`]?.license || 'UNKNOWN';

      components.push({
        type: 'library',
        name,
        version: resolvedVersion,
        purl: `pkg:npm/${name.startsWith('@') ? name.replace('/', '%2F') : name}@${resolvedVersion}`,
        licenses: [{ license: { id: license } }],
        scope: 'optional',
      });
    }
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: sbomId,
    version: 1,
    metadata: {
      timestamp,
      tools: [
        { vendor: 'QA Guardian', name: 'SBOM Generator', version: '1.0.0' }
      ],
      component: {
        type: 'application',
        name: packageJson.name || 'unknown',
        version: packageJson.version || '1.0.0',
        description: packageJson.description,
      },
    },
    components,
  };
}

// ============================================================================
// SPDX Conversion
// ============================================================================

function convertCycloneDxToSpdx(cycloneDx: CycloneDxSbom, namespace: string): SpdxSbom {
  const timestamp = new Date().toISOString();
  const projectName = cycloneDx.metadata.component.name;

  const packages: SpdxSbom['packages'] = cycloneDx.components.map((component, idx) => {
    const license = component.licenses?.[0]?.license?.id ||
                   component.licenses?.[0]?.license?.name ||
                   'NOASSERTION';

    return {
      SPDXID: `SPDXRef-Package-${idx + 1}`,
      name: component.name,
      versionInfo: component.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: license,
      licenseDeclared: license,
      externalRefs: component.purl ? [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: component.purl,
        }
      ] : undefined,
    };
  });

  // Add relationships (all packages depend on the root document)
  const relationships: SpdxSbom['relationships'] = [
    {
      spdxElementId: 'SPDXRef-DOCUMENT',
      relatedSpdxElement: 'SPDXRef-Package-Root',
      relationshipType: 'DESCRIBES',
    },
    ...packages.map(pkg => ({
      spdxElementId: 'SPDXRef-Package-Root',
      relatedSpdxElement: pkg.SPDXID,
      relationshipType: 'DEPENDS_ON',
    })),
  ];

  // Add root package
  const rootPackage: SpdxSbom['packages'][0] = {
    SPDXID: 'SPDXRef-Package-Root',
    name: projectName,
    versionInfo: cycloneDx.metadata.component.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: 'NOASSERTION',
  };

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${projectName}-SBOM`,
    documentNamespace: namespace,
    creationInfo: {
      created: timestamp,
      creators: ['Tool: QA Guardian SBOM Generator-1.0.0'],
      licenseListVersion: '3.19',
    },
    packages: [rootPackage, ...packages],
    relationships,
  };
}

// ============================================================================
// Storage Functions
// ============================================================================

async function storeSbomInMinio(sbomId: string, content: string, filename: string): Promise<{ bucket: string; key: string } | null> {
  const client = getMinioClient();
  if (!client) return null;

  const bucketReady = await ensureBucketExists();
  if (!bucketReady) return null;

  try {
    const key = `${sbomId}/${filename}`;
    const buffer = Buffer.from(content);
    await client.putObject(SBOM_BUCKET, key, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });
    console.log(`[SBOM] Stored in MinIO: ${SBOM_BUCKET}/${key}`);
    return { bucket: SBOM_BUCKET, key };
  } catch (error) {
    console.error('[SBOM] Failed to store in MinIO:', error);
    return null;
  }
}

function storeSbomLocally(sbomId: string, content: string, filename: string): string | null {
  try {
    ensureLocalDir();
    const sbomDir = path.join(LOCAL_SBOM_DIR, sbomId);
    if (!fs.existsSync(sbomDir)) {
      fs.mkdirSync(sbomDir, { recursive: true });
    }
    const filePath = path.join(sbomDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[SBOM] Stored locally: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('[SBOM] Failed to store locally:', error);
    return null;
  }
}

function storeSbomInMemory(sbomId: string, content: string, metadata: StoredSbom): void {
  inMemorySbomStore.set(sbomId, { content, metadata });
  console.log(`[SBOM] Stored in memory: ${sbomId}`);
}

// ============================================================================
// Retrieval Functions
// ============================================================================

export async function retrieveSbom(sbomId: string): Promise<{ content: string; metadata: StoredSbom } | null> {
  const metadata = sbomIndex.get(sbomId);
  if (!metadata) return null;

  // Try in-memory first
  const inMemory = inMemorySbomStore.get(sbomId);
  if (inMemory) {
    return inMemory;
  }

  // Try local storage
  if (metadata.storage_location === 'local' && fs.existsSync(metadata.storage_path)) {
    const content = fs.readFileSync(metadata.storage_path, 'utf-8');
    return { content, metadata };
  }

  // Try MinIO
  if (metadata.storage_location === 'minio') {
    const client = getMinioClient();
    if (client) {
      try {
        const stream = await client.getObject(SBOM_BUCKET, metadata.storage_path);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks).toString('utf-8');
        return { content, metadata };
      } catch (error) {
        console.error('[SBOM] Failed to retrieve from MinIO:', error);
      }
    }
  }

  return null;
}

// ============================================================================
// Main Generation Function
// ============================================================================

export interface GenerateSbomOptions {
  projectId: string;
  projectName: string;
  projectPath?: string;
  format: 'cyclonedx' | 'spdx';
  includeDevDeps: boolean;
  generatedBy: string;
}

export async function generateSbom(options: GenerateSbomOptions): Promise<SbomGenerationResult> {
  const { projectId, projectName, format, includeDevDeps, generatedBy } = options;

  // Default to current working directory for QA Guardian itself
  const projectPath = options.projectPath || process.cwd();

  const sbomId = `sbom-${projectId}-${Date.now()}`;
  const generatedAt = new Date().toISOString();

  // Generate CycloneDX SBOM
  console.log(`[SBOM] Generating CycloneDX for project: ${projectName}`);
  const cycloneDxSbom = await generateCycloneDxFromNpm(projectPath, includeDevDeps);

  // Convert to SPDX if requested
  let sbom: CycloneDxSbom | SpdxSbom;
  let specVersion: string;
  let filename: string;

  if (format === 'spdx') {
    const namespace = `https://qa-guardian.example.com/sbom/${sbomId}`;
    sbom = convertCycloneDxToSpdx(cycloneDxSbom, namespace);
    specVersion = '2.3';
    filename = `sbom-${projectName.toLowerCase().replace(/\s+/g, '-')}-spdx.json`;
  } else {
    sbom = cycloneDxSbom;
    specVersion = '1.5';
    filename = `sbom-${projectName.toLowerCase().replace(/\s+/g, '-')}-cyclonedx.json`;
  }

  const sbomContent = JSON.stringify(sbom, null, 2);
  const sizeBytes = Buffer.byteLength(sbomContent, 'utf-8');

  // Calculate license distribution
  const licenseDistribution: Record<string, number> = {};
  const components = format === 'cyclonedx'
    ? (sbom as CycloneDxSbom).components
    : (sbom as SpdxSbom).packages.filter(p => p.SPDXID !== 'SPDXRef-Package-Root');

  let productionCount = 0;
  let devCount = 0;

  for (const comp of components) {
    let license: string;
    let isProduction: boolean;

    if (format === 'cyclonedx') {
      const cdxComp = comp as CycloneDxSbom['components'][0];
      license = cdxComp.licenses?.[0]?.license?.id || 'UNKNOWN';
      isProduction = cdxComp.scope !== 'optional';
    } else {
      const spdxPkg = comp as SpdxSbom['packages'][0];
      license = spdxPkg.licenseConcluded || 'UNKNOWN';
      isProduction = true; // SPDX doesn't track scope the same way
    }

    licenseDistribution[license] = (licenseDistribution[license] || 0) + 1;
    if (isProduction) productionCount++;
    else devCount++;
  }

  // Store the SBOM
  let storageInfo: SbomGenerationResult['storage'];

  // Try MinIO first
  const minioResult = await storeSbomInMinio(sbomId, sbomContent, filename);
  if (minioResult) {
    storageInfo = {
      location: 'minio',
      bucket: minioResult.bucket,
      key: minioResult.key,
    };
  } else {
    // Try local storage
    const localPath = storeSbomLocally(sbomId, sbomContent, filename);
    if (localPath) {
      storageInfo = {
        location: 'local',
        path: localPath,
      };
    } else {
      // Fall back to in-memory
      storageInfo = {
        location: 'memory',
      };
    }
  }

  // Create metadata for index
  const storedSbom: StoredSbom = {
    id: sbomId,
    project_id: projectId,
    format,
    spec_version: specVersion,
    generated_at: generatedAt,
    generated_by: generatedBy,
    filename,
    content_type: 'application/json',
    size_bytes: sizeBytes,
    storage_location: storageInfo.location,
    storage_path: storageInfo.location === 'minio'
      ? `${storageInfo.key}`
      : storageInfo.location === 'local'
        ? storageInfo.path!
        : sbomId,
    component_count: components.length,
    license_distribution: licenseDistribution,
  };

  // Store in memory if needed
  if (storageInfo.location === 'memory') {
    storeSbomInMemory(sbomId, sbomContent, storedSbom);
  }

  // Add to index
  sbomIndex.set(sbomId, storedSbom);

  // Check NTIA minimum elements compliance
  const missingElements: string[] = [];
  if (!cycloneDxSbom.metadata.component.name) missingElements.push('supplier_name');
  if (!cycloneDxSbom.metadata.component.version) missingElements.push('component_version');
  if (components.some(c => {
    if (format === 'cyclonedx') {
      return !(c as CycloneDxSbom['components'][0]).purl;
    }
    return false;
  })) {
    missingElements.push('unique_identifiers');
  }

  return {
    sbom_id: sbomId,
    project_id: projectId,
    project_name: projectName,
    format,
    spec_version: specVersion,
    generated_at: generatedAt,
    generated_by: generatedBy,
    summary: {
      total_components: components.length,
      production_components: productionCount,
      dev_components: devCount,
      unique_licenses: Object.keys(licenseDistribution).length,
      license_distribution: licenseDistribution,
    },
    download: {
      url: `/api/v1/projects/${projectId}/sbom/${sbomId}/download`,
      filename,
      content_type: 'application/json',
      size_bytes: sizeBytes,
    },
    sbom,
    storage: storageInfo,
    compliance: {
      executive_order_14028: missingElements.length === 0,
      ntia_minimum_elements: missingElements.length === 0,
      missing_elements: missingElements,
    },
  };
}

// Export for testing
export { convertCycloneDxToSpdx, generateCycloneDxFromPackageJson };
