import { Roles } from '@kleros/kleros-app'

/**
 * Role used for all JSON-wrapper uploads to Atlas (evidence JSON,
 * item.json, meta-evidence.json, match-file.json).
 *
 * Why CurateItemFile rather than a semantically-named role like
 * MetaEvidence, Evidence, or Generic?
 *  - Curate v1 contracts (this app) require an IPFS URI pointing to a
 *    JSON. Curate v2 sidesteps this by passing JSON inline in tx args,
 *    so Atlas's Curate product was never configured with a generic-JSON
 *    role.
 *  - Of the roles the Atlas backend exposes for the Curate product, only
 *    Policy and CurateItemFile accept application/json. CurateItemFile is
 *    the most permissive (20 MB, image/* + video/* + pdf + json + text/*)
 *    and is semantically the closest catch-all for "structured data
 *    attached to a curate workflow".
 *  - Roles.Evidence does NOT accept application/json — using it for the
 *    JSON wrapper throws "Unsupported file type" at upload time. (User-
 *    attached evidence files like PNG/PDF still use Roles.Evidence
 *    directly; that's the correct semantic role for them.)
 *  - Roles.MetaEvidence (the intuitive choice for registry meta-evidence)
 *    isn't configured on the Curate product — it would throw
 *    "Unsupported role".
 *
 * If Atlas later adds a proper generic-JSON role for the Curate product,
 * update this single export.
 */
export const JSON_UPLOAD_ROLE = Roles.CurateItemFile
