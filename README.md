# GreenCode CRM

Aplicacion de gestion integral para la operativa de GreenCode: produccion de microgreens, almacen, ventas, reparto, trazabilidad y control economico.

## Tecnologia

- React 19 y React Router
- Vite 8
- Supabase: Postgres, Auth, Realtime y Edge Functions
- jsPDF para facturas, albaranes, trazabilidad y etiquetas
- Recharts para paneles e indicadores

## Desarrollo local

Requisitos: Node.js y npm.

```powershell
npm.cmd install
npm.cmd run dev
```

Comprobaciones antes de publicar:

```powershell
npm.cmd run lint
npm.cmd run build
```

## Areas funcionales

- Administracion de clientes, proveedores, catalogo, pedidos, albaranes, facturas y gastos.
- Control de cultivos, siembras, tareas, cosechas y producto terminado.
- Gestion de semillas, consumibles, envases, lotes y movimientos de almacen.
- Trazabilidad completa desde proveedor y siembra hasta cliente.
- Rentabilidad, costes y documentacion PDF.
- Panel operativo de TV, reparto movil y administracion de usuarios.

## Base de datos

Las migraciones incrementales se guardan en `supabase/migrations/`. Las funciones de servidor se encuentran en `supabase/functions/`.

No deben ejecutarse scripts SQL ni migraciones contra produccion sin revisar su alcance y contar con autorizacion expresa.

## Contexto para Codex

Las instrucciones persistentes del proyecto estan en `AGENTS.md`. Al abrir esta carpeta como proyecto de Codex, el asistente podra reconocer GreenCode CRM y sus reglas de trabajo automaticamente.
