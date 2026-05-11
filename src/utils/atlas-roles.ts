import { Roles } from '@kleros/kleros-app'

// CurateItemFile is the only Curate-product Atlas role that accepts
// application/json, so all JSON-wrapper uploads (evidence, item,
// meta-evidence) go through it.
export const JSON_UPLOAD_ROLE = Roles.CurateItemFile
