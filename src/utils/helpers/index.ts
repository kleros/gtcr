export const toKError = (err: any): KError => {
  if (typeof err === 'object')
    if (Object.prototype.hasOwnProperty.call(err, 'message')) return err
    else return { ...err, message: err.toString() }
  else return { message: err.toString() }
}

export const IsEmpty = (val: any): boolean => {
  if (typeof val === 'object') return !val || Object.keys(val).length === 0
  else if (Array.isArray(val)) return val.length === 0
  else if (typeof val === 'number') return false
  else return !val
}
