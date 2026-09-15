module.exports = {
  content: ['./*.html'],
  theme: {
    extend: {
      colors: {
        brand: { green: '#15803d', greenHover: '#166534', greenLight: '#22c55e', orange: '#ea580c', orangeHover: '#c2410c', yellow: '#f59e0b', red: '#dc2626' },
        surface: { 900: '#0b1320', 800: '#111c2e', 700: '#1e2d42', 600: '#2c3e55' }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif']
      }
    }
  },
  plugins: []
};
