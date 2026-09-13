const normalizePhone = (phoneNumber, phoneSuffix) => {
  const suffix = String(phoneSuffix || '').trim().replace(/[\s()-]/g, '');
  let number = String(phoneNumber || '').trim().replace(/[^0-9]/g, '');

  if (!/^\+\d{1,4}$/.test(suffix)) {
    throw new Error('Invalid country calling code');
  }

  if (!/^\d{4,14}$/.test(number)) {
    throw new Error('Invalid mobile number');
  }

  const fullPhoneNumber = `${suffix}${number}`;
  const digitCount = fullPhoneNumber.replace(/\D/g, '').length;
  if (digitCount < 7 || digitCount > 15) {
    throw new Error('Invalid mobile number length');
  }

  return {
    phoneNumber: number,
    phoneSuffix: suffix,
    fullPhoneNumber,
  };
};

module.exports = normalizePhone;
