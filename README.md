# L4D2 Mod Manager

Aplicación de escritorio para Windows que administra mods y configuraciones de **Left 4 Dead 2**. Electron abre la interfaz incluida en el proyecto directamente. No utiliza servidor local, navegador externo, Express, Vite ni React.

## Qué hace

- Detecta Steam desde el registro de Windows y sus ubicaciones habituales; busca L4D2 en las bibliotecas de `libraryfolders.vdf`.
- Permite seleccionar otra instalación y recuerda la ruta.
- Lista los VPK del Workshop realmente presentes en disco, con búsqueda, orden, estado y detalles de Steam.
- Activa/desactiva los VPK cambiando su extensión entre `.vpk` y `.vpk.disabled`.
- **Prepara mods de Workshop**: copia el VPK a `Workshop_<ID>/pak01_dir.vpk` y registra esa carpeta en `SearchPaths` de `gameinfo.txt`. Conserva el original y admite archivos VPK divididos si sus segmentos están presentes junto al directorio.
- **Mods personalizados**: muestra las carpetas que el usuario movió y registró manualmente en `gameinfo.txt`. Se conserva este funcionamiento; no se añadió un importador de mods ni datos de demostración. Quitar un registro manual conserva su carpeta.
- Edita `gameinfo.txt`, `autoexec.cfg`, `addonconfig.cfg` y los parámetros de inicio de Steam para la cuenta seleccionada.
- Crea copias de configuraciones existentes antes de modificarlas y permite restaurarlas.
- Envía a la Papelera las carpetas creadas por esta versión al retirar sus mods. Las carpetas manuales y las creadas por versiones antiguas se conservan al quitar su registro.

Preparar un mod no reescribe su contenido ni garantiza compatibilidad con todos los modos o servidores. Las copias preparadas son independientes de las actualizaciones de Workshop. Los requisitos se consultan al abrir los detalles; una consulta fallida se indica como no verificada.

## Ejecutar el proyecto

Requiere Windows y Node.js LTS (22 o superior).

```cmd
npm ci
npm start
```

También puedes abrir `abrir_app_escritorio.bat` desde la carpeta del proyecto. El archivo instala las dependencias si no encuentra Electron.

## Crear el ejecutable para PC

```cmd
npm run build
```

El portable queda en `release\L4D2-Mod-Manager-1.1.0-x64.exe`. El usuario final puede abrir el `.exe` sin instalar Node.js ni ejecutar comandos.

GitHub Actions dispone del flujo **Windows desktop**: instala las dependencias con el archivo de bloqueo, comprueba el código, ejecuta las pruebas y construye el portable en Windows. El ejecutable se descarga desde el artefacto `L4D2-Mod-Manager-Windows` de una ejecución correcta.

## Uso

1. Abre la aplicación. Si detecta la instalación, carga sus rutas automáticamente. Si no, pulsa **Elegir juego** y selecciona la carpeta que contiene `left4dead2\gameinfo.txt`.
2. En **Workshop**, abre los detalles para revisar requisitos. Activa el mod antes de prepararlo; puedes preparar varios seleccionados.
3. En **Mods preparados**, revisa las copias registradas por la herramienta. En **Mods personalizados**, revisa las rutas agregadas manualmente.
4. En **Configuraciones**, edita y guarda. Para los parámetros de inicio, cierra Steam primero y selecciona la cuenta correcta. Cierra también el juego antes de modificar sus archivos.
5. En **Copias de seguridad**, restaura la configuración anterior cuando lo necesites. Si retiraste una carpeta de mod, recupera también esa carpeta desde la Papelera de Windows.

Los borradores de los editores se conservan al cambiar de sección durante la sesión. Se descartan al cerrar la aplicación o cambiar de instalación.

## Carpetas

| Ruta | Función |
| --- | --- |
| `app/main.cjs` | Ventana de escritorio, diálogos nativos y comunicación con el sistema |
| `app/preload.cjs` | Operaciones permitidas para la interfaz |
| `app/services/manager.cjs` | Gestión de mods, rutas, configuraciones y copias |
| `app/services/files.cjs` | Lectura KeyValues de Valve, VPK y escrituras con respaldo |
| `app/services/steam.cjs` | Detección de Steam, bibliotecas, cuentas y metadatos del Workshop |
| `app/renderer/` | Interfaz, estilos y acciones; archivos locales sin compilación web |
| `tests/` | Pruebas con instalaciones y configuraciones temporales |
| `scripts/check.cjs` | Verificación de sintaxis y ausencia de servidor local |
| `.github/workflows/windows.yml` | Construcción del ejecutable en Windows |

Las preferencias, la caché y las copias se guardan en el directorio de datos de usuario de la aplicación, fuera del código y del ejecutable. No se guardan tokens de GitHub. Workshop y traducción requieren conexión; la gestión de archivos y configuraciones funciona con los archivos locales.

## Verificar cambios

```cmd
npm run check
npm test
```

Las pruebas usan carpetas temporales: no alteran tu instalación de Steam ni el juego. Comprueban lectura de rutas manuales, conservación de originales, preparación y recuperación, rechazo de rutas ajenas, límites de bloques KeyValues y selección de cuentas.
