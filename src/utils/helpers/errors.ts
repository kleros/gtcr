export const toKError = (err: any): KError => {
  if (typeof err === 'object')
    if (Object.prototype.hasOwnProperty.call(err, 'message')) return err
    else return { ...err, message: err.toString() }
  else return { message: err.toString() }
}
