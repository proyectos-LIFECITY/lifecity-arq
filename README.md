# LifeCity ARQ · Plataforma Colaborativa de Diseño MEP (2D)

App web para que los diseñadores entren, vean **los proyectos en los que están inscritos** y, dentro de cada uno, accedan a las **disciplinas** con permiso por rol. Construida a partir del **Visor Cali (repo 44)** y el modelo de colaboración del **BIM Hub (repo 73 · "Revit Model Report Automation")**.

## 🌐 En línea (GitHub Pages)
**https://proyectos-lifecity.github.io/lifecity-arq/** — corre en el navegador, sin instalar.

> Nota: en esta versión los datos son **local-first** (se guardan en el navegador de cada usuario). Para colaboración real multi-usuario entre máquinas hay que conectar el backend (BIM Hub Cloudflare) — el `js/store.js` ya está diseñado para conmutar sin reescribir la UI.

## Cómo ejecutar en local
```
python serve.py
```
o doble clic en **`Iniciar LifeCity ARQ.bat`** → abre `http://localhost:8130/login.html`. También hay **`INSTALAR.bat`** (crea icono en el Escritorio) para uso offline.

## Cuentas demo
| Correo | Clave | Rol | Edita |
|---|---|---|---|
| ana@lifecity.com.co | electrico | Eléctrico | solo Eléctrico |
| carlos@lifecity.com.co | hidro | Hidrosanitario | solo Hidrosanitario |
| luis@lifecity.com.co | gas | Gas | solo Gas |
| admin@lifecity.com.co | admin | Admin | todo |

> Un diseñador **ve todas** las disciplinas del proyecto pero **solo edita la suya** (el ing. eléctrico ve hidro/estructura/etc. pero solo edita Eléctrico).

## Flujo
1. **Login** → **Proyectos** inscritos → **Disciplina** (6 carpetas con candado/badge de permiso) → **Contenedores**: Modelo / Planos / Cantidades.
2. **Modelo** = lienzo **2D en planta** (SVG):
   - Paleta por disciplina. **Eléctrico**: tablero, tomas (normal/GFCI/220), luminarias, interruptor, medidor. **Hidrosanitario**: lavamanos, ducha, sanitario, lavaplatos, sifón, poceta, lavadero, lavadora, bajante. **Gas**: estufa, calentador, lavadora, RP-40, medidor, bajante. **Estructura**: columna, viga, muro (obstáculos de ruteo).
   - **Vínculos**: activa otras disciplinas como fondo de referencia (panel derecho).
   - **Circuitos (eléctrico)**: selecciona un **tablero** + varias **tomas** (o **luminarias**) con Shift → *Crear circuito*. Se dibuja **línea punteada** y se numera **por orden de creación**; tomas de un lado, iluminación del otro.
   - **⚡ Cuadro de cargas**, **Unifilar** (por apto y edificio) y **RETIE 2026** (recomendaciones).
3. **Cantidades**: tabla automática (conteos + circuitos/conductor, o tubería por diámetro).

## Controles del editor
- Rueda = zoom · arrastrar vacío = desplazar · clic en aparato = seleccionar (Shift = varios).
- **R** = rotar 90° · **Supr** = borrar · **Esc** = herramienta Seleccionar · **Guardar** persiste el modelo.

## Hidrosanitario (ruteo al bajante + diámetros)
En **Modelo** (rol hidrosanitario): coloca aparatos + un **bajante (BR)**, activa el vínculo **Estructura** (columnas/vigas/muros) y pulsa **Trazar mejor ruta**:
- El motor `js/hydro/routing.js` construye la red con **A\* ortogonal** que **evita la estructura**, **fusiona ramales** (zanja compartida) hacia el bajante, **evalúa varias rutas potenciales** y elige la de menor costo con un **modelo de costo lineal (ML-ready: pesos ajustables/entrenables)**.
- **Diámetros** por unidades de descarga (UDES) en `js/hydro/diameters.js` (NTC 1500/RAS, configurable): segmentos coloreados por Ø, colector dimensionado al acumulado (el sanitario fuerza Ø≥100 mm).
- **≈ Diámetros / Norma**: tabla de tramos + recomendaciones (pendiente, ventilación, registros, avisos de estructura).
- **Cantidades** de hidro: metros de tubería por diámetro.

> Estructura se coloca desde el rol **Estructura** (o **admin**): columna/viga/muro actúan como obstáculos del ruteo.

## Gas (ruteo al medidor + diámetros)
Mismo motor que hidro, con flujo de gas (`js/gas/`): coloca artefactos (estufa/calentador/secadora) + **medidor** (uno por piso) + regulador **RP-40**, y **Trazar mejor ruta** → red que evita estructura hasta el medidor, con **diámetros por potencia acumulada (kW)** (NTC 2505, configurable). **🔥 Diámetros / Norma** da la tabla de tramos y recomendaciones (medidor por piso, ventilación del calentador, corte y prueba de hermeticidad). Cantidades: metros de tubería de gas por diámetro.

## Normativa
- **Eléctrico**: motor `js/electrical/retie.js` basado en **RETIE 2026 (Res. 40284/2026, vigente 01-ene-2026, sin período de gracia)** + NTC 2050. Constantes **configurables**; verificar contra el texto oficial. Incluye la novedad 2026 del alcance de **15.000 VA** para técnicos/tecnólogos.
- **Hidrosanitario**: diámetros y ruteo (NTC 1500/RAS). **Gas**: diámetros y ruteo (NTC 2505). Constantes configurables en `js/hydro/` y `js/gas/`; verificar contra la norma.

## Arquitectura
Web estática sin build · ES-modules · SVG. Datos **local-first** en `js/store.js` (localStorage) espejando el esquema del BIM Hub → los mismos métodos apuntarán al Worker Cloudflare sin reescribir la UI.

```
login.html · index.html (shell + router)
js/store.js · auth.js · permissions.js · app.js · ui.js
js/views/{projects,project,container}.js
js/editor2d.js · palettes.js · quantities.js
js/electrical/{circuits,retie,panel,unifilar}.js
js/hydro/{routing,diameters,review}.js
js/gas/{diameters,review}.js
data/seed.json · css/app.css
```

## Siguiente iteración
- Reemplazar los pesos del modelo de costo por un **modelo entrenado** con proyectos reales (el ruteo ya está estructurado como inferencia de un scorer ajustable).
- Generación **3D** desde el mismo modelo 2D (`scenes`).
- Conmutar `store.js` a backend en vivo (BIM Hub Cloudflare).
