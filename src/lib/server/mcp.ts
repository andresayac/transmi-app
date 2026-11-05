import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTools } from '@/lib/server/assistant/tools';

/** Read by the MCP client's model when it connects; the tool descriptions carry the details. */
const INSTRUCTIONS = `TransMi: datos en vivo para moverse por Bogotá en TransMilenio, TransMiZonal (SITP), alimentadores y TransMiCable. Es un proyecto educativo independiente, no un canal oficial de TransMilenio S.A.
- Para planear un viaje necesitas coordenadas: resuelve cada lugar con buscar_lugar y luego llama a planear_viaje. Este servidor no conoce la ubicación del usuario: si dice "aquí" o "cerca", pregúntale dónde está.
- Para detalle_ruta y buses_en_vivo, primero usa buscar_rutas (o rutas_estacion, zonas_sitp) y pasa el id, el código y el nombre que devuelve.
- consultar_saldo necesita el número de la tarjeta TuLlave (impreso al respaldo): pídeselo al usuario y no lo repitas completo en tu respuesta. Si el saldo es bajo, ofrece un punto de recarga abierto con puntos_recarga_cercanos.
- seguir_viaje necesita el enlace de "Sigue mi viaje" que le enviaron al usuario.
- Las horas son de Bogotá (UTC−5). No inventes rutas, horarios ni paradas: si una herramienta no devuelve datos, dilo y sugiere una alternativa.`;

/**
 * The assistant's tools as an MCP server. Built per request: the HTTP transport is stateless,
 * so nothing outlives the call.
 */
export function createMcpServer(appOrigin: string): McpServer {
    const server = new McpServer({ name: 'transmi', title: 'TransMi', version: '1.0.0' }, { instructions: INSTRUCTIONS });

    for (const tool of createTools(() => { }, {}, { appOrigin })) {
        server.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: { readOnlyHint: true, openWorldHint: true },
            },
            async (input) => {
                try {
                    return { content: [{ type: 'text', text: await tool.run(input) }] };
                } catch (err) {
                    return { content: [{ type: 'text', text: err instanceof Error ? err.message : 'La consulta falló.' }], isError: true };
                }
            },
        );
    }
    return server;
}
