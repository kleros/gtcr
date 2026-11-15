import { ItemTypes } from '@kleros/gtcr-encoder'
import {
  LIST_OF_LISTS_ADDRESS_LABEL,
  listOfListsEntryAddress,
} from 'components/curate/verified-rule'

/**
 * The list an entry of a list of lists points to: the value of its field
 * labelled like the list's own first GTCR address column ("Address" when
 * the list names none). Its row on the list page opens that list and the
 * seal reads the same field (listOfListsEntryAddress says why nothing else
 * may decide): a Light entry is a file that names its own columns, so its
 * first field can be another address. Lowercase, or undefined.
 */
export const linkedListAddress = (
  fields: { label?: unknown; value?: unknown }[] | undefined,
  listColumns: Column[] | undefined,
): string | undefined => {
  const label =
    (listColumns ?? []).find(
      (column) =>
        typeof column.type === 'string' &&
        column.type.toLowerCase() === ItemTypes.GTCR_ADDRESS.toLowerCase(),
    )?.label ?? LIST_OF_LISTS_ADDRESS_LABEL
  return listOfListsEntryAddress(fields, label) ?? undefined
}

export default linkedListAddress
