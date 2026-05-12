import { Roles } from '@kleros/kleros-app'
import { ItemTypes } from '@kleros/gtcr-encoder'
import type { Column } from 'pages/item-details/modals/submit'

type UploadFile = (file: File, role: Roles) => Promise<string | null>
type SetFieldValue = (
  field: string,
  value: unknown,
  shouldValidate?: boolean,
) => void

interface ResolveStashedFilesParams {
  columns: Column[]
  values: Record<string, string | File>
  uploadFile: UploadFile
  setFieldValue: SetFieldValue
}

/**
 * Walks the form values for a submission, uploading any stashed `File` to
 * IPFS under the role appropriate for its column type and persisting the
 * resulting URI back into form state so a retry after a tx failure does
 * not re-upload. Returns the column-keyed map of resolved string values.
 */
export const resolveStashedFiles = async ({
  columns,
  values,
  uploadFile,
  setFieldValue,
}: ResolveStashedFilesParams): Promise<Record<string, string>> => {
  const resolved: Record<string, string> = {}
  for (const column of columns) {
    const value = values[column.label]
    if (value instanceof File) {
      const role =
        column.type === ItemTypes.IMAGE
          ? Roles.CurateItemImage
          : Roles.CurateItemFile
      const uri = await uploadFile(value, role)
      if (!uri) throw new Error(`Failed to upload ${column.label} to IPFS.`)
      resolved[column.label] = uri
      setFieldValue(column.label, uri, false)
    } else resolved[column.label] = (value as string) ?? ''
  }
  return resolved
}
