export type PoiPhotoOption = {
  id: string;
  label: string;
  fileName: string;
  url: string;
};

const photoModules = import.meta.glob(
  '../../../assets/fotopins/*.{png,jpg,jpeg,webp,svg,PNG,JPG,JPEG,WEBP,SVG}',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, string>;

const normalizePhotoKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const collapsePhotoKey = (value: string) => normalizePhotoKey(value).replace(/_/g, '');
const buildPhotoLabel = (fileName: string) => fileName.replace(/\.[^.]+$/, '');
const buildStoredPoiPhotoReference = (fileName: string) => `fotopins/${fileName}`;
const extractPhotoFileName = (value: string) => value.split(/[\\/]/).pop() ?? value;
const normalizePhotoFileName = (value: string) => extractPhotoFileName(value).trim().toLowerCase();
const normalizePhotoStem = (value: string) => normalizePhotoKey(extractPhotoFileName(value));
const isStoredPoiPhotoReference = (value: string) => /(^|[\\/])fotopins[\\/]/i.test(value.trim());
const isGenericPoiIndicator = (value?: string | null) =>
  value?.trim().toLowerCase().includes('/images/pois/indicadores/') ?? false;

export const poiPhotoLibrary: PoiPhotoOption[] = Object.entries(photoModules)
  .map(([modulePath, url]) => {
    const fileName = modulePath.split('/').pop() ?? modulePath;
    const label = buildPhotoLabel(fileName);

    return {
      id: normalizePhotoKey(label),
      label,
      fileName,
      url,
    };
  })
  .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));

const photoUrlByKey = Object.fromEntries(poiPhotoLibrary.map((photo) => [photo.id, photo.url]));
const photoOptionByKey = Object.fromEntries(poiPhotoLibrary.map((photo) => [photo.id, photo]));
const photoOptionByCollapsedKey = Object.fromEntries(
  poiPhotoLibrary.map((photo) => [collapsePhotoKey(photo.id), photo]),
);
const photoOptionByUrl = Object.fromEntries(poiPhotoLibrary.map((photo) => [photo.url, photo]));
const photoOptionByFileName = Object.fromEntries(
  poiPhotoLibrary.map((photo) => [normalizePhotoFileName(photo.fileName), photo]),
);
const photoOptionByStoredReference = Object.fromEntries(
  poiPhotoLibrary.map((photo) => [buildStoredPoiPhotoReference(photo.fileName).toLowerCase(), photo]),
);

const poiPhotoAliasByLookupKey: Record<string, string> = {};

const getPoiPhotoLookupCandidates = (poiId?: string | null, poiName?: string | null) => {
  const baseCandidates = [poiId, poiName].map((value) => value?.trim()).filter(Boolean) as string[];
  const candidates = new Set<string>();

  for (const candidate of baseCandidates) {
    candidates.add(candidate);

    const alias = poiPhotoAliasByLookupKey[normalizePhotoKey(candidate)];
    if (alias) {
      candidates.add(alias);
    }
  }

  return [...candidates];
};

const findPoiPhotoOptionForPoi = (poiId?: string | null, poiName?: string | null) => {
  const candidates = getPoiPhotoLookupCandidates(poiId, poiName);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePhotoKey(candidate);
    const collapsedCandidate = collapsePhotoKey(candidate);
    const exactMatch = photoOptionByKey[normalizedCandidate] ?? photoOptionByCollapsedKey[collapsedCandidate];
    if (exactMatch) return exactMatch;
  }

  for (const candidate of candidates) {
    const collapsedCandidate = collapsePhotoKey(candidate);
    if (!collapsedCandidate) continue;

    const partialMatch = poiPhotoLibrary.find((photo) => {
      const collapsedPhotoKey = collapsePhotoKey(photo.id);
      return collapsedCandidate.includes(collapsedPhotoKey) || collapsedPhotoKey.includes(collapsedCandidate);
    });

    if (partialMatch) return partialMatch;
  }

  return null;
};

export const getSuggestedPoiPhotoOption = (poiId?: string | null, poiName?: string | null) =>
  findPoiPhotoOptionForPoi(poiId, poiName);

export const getStoredPoiPhotoReference = (photo: PoiPhotoOption) => buildStoredPoiPhotoReference(photo.fileName);

export const findPoiPhotoOption = (value?: string | null) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  return (
    photoOptionByUrl[trimmedValue] ??
    photoOptionByStoredReference[trimmedValue.toLowerCase()] ??
    photoOptionByFileName[normalizePhotoFileName(trimmedValue)] ??
    photoOptionByFileName[normalizePhotoFileName(extractPhotoFileName(trimmedValue))] ??
    photoOptionByKey[normalizePhotoStem(trimmedValue)] ??
    poiPhotoLibrary.find((photo) => photo.id === normalizePhotoKey(trimmedValue)) ??
    null
  );
};

export const findPoiPhotoOptionByUrl = (url?: string | null) => findPoiPhotoOption(url);

export const resolvePoiPhotoUrl = (value?: string | null) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;
  const matchedOption = findPoiPhotoOption(trimmedValue);
  if (matchedOption) {
    return matchedOption.url;
  }

  return isStoredPoiPhotoReference(trimmedValue) ? null : trimmedValue;
};

export const getAutoAssignedPoiPhotoReference = (poiId?: string | null, poiName?: string | null, currentValue?: string | null) => {
  const currentOption = findPoiPhotoOption(currentValue);
  if (currentOption) {
    return getStoredPoiPhotoReference(currentOption);
  }

  const trimmedValue = currentValue?.trim();
  if (trimmedValue && !isGenericPoiIndicator(trimmedValue)) {
    return trimmedValue;
  }

  const matchedOption = findPoiPhotoOptionForPoi(poiId, poiName);
  if (matchedOption) {
    return getStoredPoiPhotoReference(matchedOption);
  }

  return trimmedValue ?? null;
};

export const getPoiPhotoImage = (poiId: string, poiName?: string | null) =>
  findPoiPhotoOptionForPoi(poiId, poiName)?.url ?? photoUrlByKey[normalizePhotoKey(poiId)] ?? null;

export const resolvePoiPrimaryPhotoUrl = (poiId?: string | null, poiName?: string | null, currentValue?: string | null) => {
  const directUrl = resolvePoiPhotoUrl(currentValue);
  if (directUrl) {
    return directUrl;
  }

  if (poiId?.trim()) {
    return getPoiPhotoImage(poiId, poiName);
  }

  return findPoiPhotoOptionForPoi(poiId, poiName)?.url ?? null;
};
