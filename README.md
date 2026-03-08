# ⚡ AlphaSignal Pro

Plataforma de Trading Algorítmico con señales en tiempo real usando datos de Binance.

## 🏗️ Estructura del Proyecto

```
AlphaSignal-Pro/
├── server/
│   ├── index.js              # Servidor Express + WebSocket
│   └── signalEngine.js       # Motor de señales (RSI, EMA, MACD, Volumen)
├── public/
│   ├── index.html             # Dashboard principal
│   ├── firebase-messaging-sw.js # Service Worker para Push Notifications
│   ├── css/
│   │   └── styles.css         # Estilos Bloomberg + Glassmorphism
│   ├── js/
│   │   └── app.js             # Lógica del frontend
│   ├── assets/                # Iconos y recursos
│   └── sounds/                # Sonidos de alerta
├── .env.example               # Variables de entorno de ejemplo
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/AlphaSignalPro-cmd/AlphSignal-Pro.git
cd AlphSignal-Pro
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 4. Configurar Firebase Auth
- Ve a [Firebase Console](https://console.firebase.google.com)
- Proyecto: `alphasignal-pro`
- Authentication > Sign-in method > Habilitar **Email/Password**
- Crear un usuario en Authentication > Users > Add User

### 5. Iniciar el servidor
```bash
npm start
```

### 6. Abrir en el navegador
```
http://localhost:3000
```

## 📡 Funcionalidades

| Funcionalidad | Descripción |
|---|---|
| **Motor de Señales Híbrido** | RSI + EMA 9/21 + MACD + Volumen. Preparado para integrar Gemini AI. |
| **Precios en Tiempo Real** | WebSocket de Binance con 8 pares: BTC, ETH, BNB, SOL, XRP, DOGE, ADA, AVAX |
| **Cronómetro 2 Minutos** | Cada señal expira después de 120 segundos con barra visual |
| **Modo Presente** | Alertas sonoras + flash visual en pantalla |
| **Modo Away** | Notificaciones Push vía Firebase Cloud Messaging |
| **Semáforo de Riesgo** | Verde (Seguro), Amarillo (Precaución), Rojo (Peligro) |
| **Módulo ELI5** | Explicaciones con metáforas simples + tooltips interactivos |
| **Seguridad** | Firebase Auth - solo usuarios autorizados |

## 🔑 Seguridad

- Acceso protegido con **Firebase Authentication**
- Solo usuarios registrados en la consola de Firebase pueden acceder
- Las señales se guardan en **Firestore** vinculadas al UID del usuario
- Comunicación WebSocket cifrada en producción (WSS)

## 🎨 Diseño

- **Dark Mode** estilo Bloomberg Terminal
- **Glassmorphism** con backdrop-blur
- Paleta: Negro profundo `#0a0a0f`, Gris carbón `#12121a`, Verde neón `#00ff41`, Rojo vibrante `#ff3b3b`
- Tipografía: Inter (UI) + JetBrains Mono (datos)
- 100% Responsive (mobile-first)

## 🧠 Motor de Señales

El motor analiza en cada cierre de vela (1 minuto):

1. **RSI (14 períodos)**: Detecta sobrecompra (>70) y sobreventa (<30)
2. **EMA 9 vs EMA 21**: Detecta cruces alcistas y bajistas
3. **Volumen**: Detecta picos de volumen (>1.5x del promedio)
4. **MACD**: Confirmación de tendencia
5. **Soporte/Resistencia**: Niveles automáticos de últimas 20 velas

### Fuerza de la señal:
- **80-100%**: Muy Fuerte (múltiples indicadores confirman)
- **60-79%**: Fuerte
- **40-59%**: Moderada
- **0-39%**: Débil (precaución)

## 🤖 Integración con IA (Gemini)

El módulo está **preparado** para integrar la API de Gemini. Para activarlo:

1. Obtener API Key de [Google AI Studio](https://aistudio.google.com)
2. Agregar `GEMINI_API_KEY=tu_key` al archivo `.env`
3. El motor enviará el contexto de mercado a Gemini para validar la tendencia

## 📱 Deploy en GitHub Pages (Solo Frontend)

Para el frontend estático:
1. Subir la carpeta `public/` al repositorio de GitHub
2. Activar GitHub Pages en Settings > Pages
3. El backend debe correr en un servidor separado (Railway, Render, etc.)

## 📝 Licencia

Uso personal. Desarrollado como herramienta de análisis.

---

> ⚠️ **Disclaimer**: Esta herramienta es solo para análisis educativo. No constituye consejo financiero. Opera bajo tu propio riesgo.
