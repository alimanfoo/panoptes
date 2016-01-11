let JD2DateTime = function(JD) {
  return new Date((JD - 2440587.5) * 24 * 60 * 60 * 1000);
};



module.exports = function(property, value) {
  if (property.isBoolean) {
      if (value == 'Yes') return value;
      return parseInt(value) ? 'Yes' : 'No';
    }

  if (property.isDate) {
      if ((value == null) || (value == 'None'))
        return '';
      var dt = JD2DateTime(parseFloat(value));
      if (isNaN(dt.getTime()))
        return '2000-01-01';
      var pad = function(n) {
        return n < 10 ? '0' + n : n;
      };
      return dt.getUTCFullYear()
        + '-' + pad(dt.getUTCMonth() + 1)
        + '-' + pad(dt.getUTCDate());
    }

  if (property.isFloat) {
      if ((value == null) || (value == 'None'))
        return '';
      else {
        value = parseFloat(value);
        if (isNaN(value))
          return '';
        else
          return value.toFixed(property.decimDigits).toString();
      }
    }
  return value.toString();
};