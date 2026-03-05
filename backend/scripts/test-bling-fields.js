/**
 * Script para inspecionar campos de pedidos da API Bling V3
 * Foco: número de etiqueta (rastreio) e número da venda
 *
 * Uso: node scripts/test-bling-fields.js
 */
require('dotenv').config({ path: '.env' });
const axios = require('axios');

const API_URL = process.env.BLING_API_URL;
const TOKEN   = process.env.BLING_ACCESS_TOKEN;

async function main() {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'enable-jwt': '1' };

  console.log('=== TESTE 1: GET /pedidos/vendas (lista, 1 pedido) ===');
  const listResp = await axios.get(`${API_URL}/pedidos/vendas`, {
    headers,
    params: { pagina: 1, limite: 1 },
  });

  const pedidoResumo = listResp.data?.data?.[0];
  if (!pedidoResumo) {
    console.log('Nenhum pedido retornado.');
    return;
  }

  console.log('\nChaves no resumo do pedido:');
  console.log(Object.keys(pedidoResumo));
  console.log('\nnumeroPedido:', pedidoResumo.numeroPedido);
  console.log('numero:', pedidoResumo.numero);
  console.log('numOrdemCompra:', pedidoResumo.numOrdemCompra);
  console.log('transporte:', JSON.stringify(pedidoResumo.transporte, null, 2));
  console.log('notasFiscais:', JSON.stringify(pedidoResumo.notasFiscais, null, 2));

  const orderId = pedidoResumo.id;
  console.log(`\n=== TESTE 2: GET /pedidos/vendas/${orderId} (detalhe) ===`);
  const detailResp = await axios.get(`${API_URL}/pedidos/vendas/${orderId}`, { headers });
  const detalhado = detailResp.data?.data;

  console.log('\nChaves no detalhe do pedido:');
  console.log(Object.keys(detalhado));

  console.log('\n--- Campos de número da venda ---');
  console.log('id:', detalhado.id);
  console.log('numero:', detalhado.numero);
  console.log('numeroPedido:', detalhado.numeroPedido);
  console.log('numOrdemCompra:', detalhado.numOrdemCompra);
  console.log('numeroEcommerce:', detalhado.numeroEcommerce);

  console.log('\n--- Campos de transporte/etiqueta ---');
  console.log('transporte:', JSON.stringify(detalhado.transporte, null, 2));

  console.log('\n--- Nota fiscal ---');
  console.log('notasFiscais:', JSON.stringify(detalhado.notasFiscais, null, 2));

  console.log('\n--- Objeto completo (resumo) ---');
  // Remover campos muito longos
  const resumo = { ...detalhado };
  delete resumo.itens;
  console.log(JSON.stringify(resumo, null, 2));
}

main().catch(err => {
  if (err.response) {
    console.error('Erro HTTP', err.response.status, JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('Erro:', err.message);
  }
});
