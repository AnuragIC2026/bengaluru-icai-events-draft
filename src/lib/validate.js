// Formats checked against the old portal's data:
// member numbers are 6 digits, student numbers are 3 letters and 7 digits (for example SRO0123456).

export const rules = {
  memberId: (v) => (/^\d{6}$/.test(v.trim()) ? '' : 'Enter the 6 digit membership number'),
  studentId: (v) => (/^[A-Z]{3}\d{7}$/.test(v.trim().toUpperCase()) ? '' : 'Enter the registration number, for example SRO0123456'),
  name: (v) => (v.trim().length >= 2 ? '' : 'Enter the full name'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address'),
  mobile: (v) => (/^[6-9]\d{9}$/.test(v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')) ? '' : 'Enter a 10 digit mobile number'),
  gender: (v) => (v ? '' : 'Choose one'),
  required: (v) => (String(v || '').trim() ? '' : 'This is required'),
  pincode: (v) => (/^\d{6}$/.test(v.trim()) ? '' : 'Enter the 6 digit pincode'),
  gstin: (v) => (!v.trim() || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.trim().toUpperCase()) ? '' : 'This does not look like a valid GSTIN'),
}

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]
