const axios = require('axios');

async function enrichGeoIP(ip) {
  if (!ip) {
    return { status: 'skipped', reason: 'missing_ip' };
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      timeout: 3000,
      params: {
        fields: 'status,message,country,city,lat,lon,isp,as,query'
      }
    });

    if (response.data.status !== 'success') {
      return { status: 'error', message: response.data.message || 'lookup_failed' };
    }

    const data = response.data;

    return {
      status: 'success',
      data: {
        ip: data.query,
        location: [data.city, data.country].filter(Boolean).join(', '),
        coordinates: { lat: data.lat, lon: data.lon },
        organization: data.isp || 'Unknown',
        asn: data.as || 'Unknown',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

module.exports = { enrichGeoIP };
