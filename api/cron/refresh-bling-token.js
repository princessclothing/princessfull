/**
 * Vercel Cron Job: Renova o token JWT do Bling automaticamente
 * 
 * Este endpoint é chamado por um cronjob configurado no vercel.json.
 * Executa a cada 5 horas (tokens expiram em 6h) para garantir que
 * sempre temos um token válido para as requisições à API do Bling.
 * 
 * Segurança: Verifica o header Authorization: Bearer cron-secret
 */

const blingService = require('../../backend/src/services/blingService');

module.exports = async (req, res) => {
  // Vercel Cron Jobs enviam header: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  // Verificar se é uma chamada autorizada
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('[cron/refresh-bling-token] Unauthorized attempt');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing CRON_SECRET' 
    });
  }

  try {
    console.log('[cron/refresh-bling-token] Starting token refresh...');

    // Forçar refresh do token chamando authenticate()
    // Se o token ainda for válido, ele retorna o atual
    // Se expirou ou está perto de expirar, faz refresh automaticamente
    const token = await blingService.forceTokenRefresh();

    const tokenPreview = token ? `${token.substring(0, 30)}...` : 'null';
    
    console.log('[cron/refresh-bling-token] Token refreshed successfully');
    console.log(`[cron/refresh-bling-token] New token: ${tokenPreview}`);

    return res.status(200).json({
      success: true,
      message: 'Bling JWT token refreshed successfully',
      tokenLength: token?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/refresh-bling-token] Error:', err.message);
    console.error('[cron/refresh-bling-token] Stack:', err.stack);

    return res.status(500).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString(),
    });
  }
};
