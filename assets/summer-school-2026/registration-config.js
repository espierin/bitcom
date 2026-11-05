// Public configuration only. Supabase/SMTP/database secrets stay on Render.
window.BITCOM_REGISTRATION = Object.freeze({
  enabled: false, // Set true only after the EPT extension and email route pass acceptance.
  api: 'https://efi-ept-api.onrender.com/api/bitcom/registration'
});
