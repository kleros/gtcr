import { Roles } from '@kleros/kleros-app'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'

type UploadFile = (file: File, role: Roles) => Promise<string | null>

interface UploadEvidenceParams {
  title: string
  description: string
  attachment?: File | null
  uploadFile: UploadFile
}

/**
 * Uploads an optional user attachment (as Roles.Evidence) and wraps the
 * resulting JSON envelope (title, description, attachment metadata) as
 * evidence.json under JSON_UPLOAD_ROLE. Returns the IPFS path of the JSON
 * envelope, which is what the GTCR contracts expect.
 */
export const uploadEvidence = async ({
  title,
  description,
  attachment,
  uploadFile,
}: UploadEvidenceParams): Promise<string> => {
  const attachmentFields: {
    fileURI?: string
    fileTypeExtension?: string
    type?: string
  } = {}

  if (attachment) {
    const fileURI = await uploadFile(attachment, Roles.Evidence)
    if (!fileURI) throw new Error('Failed to upload attachment to IPFS.')
    attachmentFields.fileURI = fileURI
    attachmentFields.fileTypeExtension = attachment.name.split('.').pop()
    attachmentFields.type = attachment.type
  }

  const evidenceJSON = {
    title,
    description,
    ...attachmentFields,
  }

  const evidenceFile = new File(
    [JSON.stringify(evidenceJSON)],
    'evidence.json',
    { type: 'application/json' },
  )
  const ipfsPath = await uploadFile(evidenceFile, JSON_UPLOAD_ROLE)
  if (!ipfsPath) throw new Error('Failed to upload evidence to IPFS.')
  return ipfsPath
}
