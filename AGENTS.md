# GreenCode CRM

Este repositorio contiene la aplicacion operativa GreenCode CRM para la gestion de una empresa de microgreens.

## Contexto del producto

- Nombre del proyecto: GreenCode CRM.
- Frontend: React 19, Vite 8 y React Router.
- Backend y datos: Supabase (Postgres, Auth, Realtime y Edge Functions).
- Idioma principal de la interfaz y del negocio: espanol.
- Usuarios principales: administracion, produccion/cultivos, almacen y reparto.

## Modulos principales

- Administracion: clientes, proveedores, productos, pedidos, albaranes, facturas y gastos.
- Produccion: cultivos, siembras, cosechas, mezclas, tareas y planificacion.
- Almacen: semillas, consumibles, envases, lotes y movimientos de stock.
- Operaciones: panel de TV y vista movil para repartidores.
- Control: trazabilidad, rentabilidad, permisos de usuarios y PDFs/etiquetas.

## Estructura relevante

- `src/pages/`: pantallas y flujos funcionales.
- `src/context/DataContext.jsx`: acceso y operaciones centrales de datos.
- `src/context/AuthContext.jsx`: autenticacion y permisos.
- `src/config/supabase.js`: cliente publico de Supabase.
- `src/utils/`: generacion de documentos PDF y etiquetas.
- `supabase/migrations/`: migraciones versionadas de base de datos.
- `supabase/functions/`: Edge Functions.

## Reglas de trabajo

- Preservar siempre los cambios locales existentes antes de editar.
- No aplicar ni ejecutar SQL contra produccion sin autorizacion explicita.
- No colocar claves privadas o `service_role` en el frontend ni en Git.
- La clave publicable/anon de Supabase puede estar en el cliente, pero la seguridad debe depender de RLS y permisos del servidor.
- Para cambios de esquema, crear una migracion nueva en `supabase/migrations/`; no modificar migraciones ya desplegadas.
- Mantener los textos visibles para usuarios en espanol.
- Antes de entregar cambios, ejecutar `npm.cmd run build` y `npm.cmd run lint` en Windows.
- No tratar `dist/`, `node_modules/`, `tmp/` ni `output/` como codigo fuente.
- Evitar ampliar componentes monoliticos; al modificar zonas grandes, extraer logica o componentes cuando sea seguro.

## Estado tecnico conocido

- La compilacion de produccion funciona.
- El lint tiene deuda tecnica pendiente; no introducir errores nuevos y corregir los relacionados con las zonas modificadas.
- Existen componentes muy grandes, especialmente `Crops.jsx`, `DataContext.jsx`, `Supplies.jsx` y `Profitability.jsx`.
- El bundle principal necesita division de codigo mediante carga diferida.
- No hay una suite automatizada de pruebas configurada actualmente.
