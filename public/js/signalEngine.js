// ============================================
// AlphaSignal Pro - Motor de Señales Híbrido
// RSI + EMA + Volume + MACD (Client-Side)
// ============================================

class SignalEngine {
    constructor() {
        this.lastSignals = {};
        this.cooldown = 60000;
    }

    calculateRSI(closes, period = 14) {
        if (closes.length < period + 1) return null;
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
            avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
        }
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    }

    calculateEMA(closes, period) {
        if (closes.length < period) return null;
        const multiplier = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < closes.length; i++) {
            ema = (closes[i] - ema) * multiplier + ema;
        }
        return ema;
    }

    calculateMACD(closes) {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        if (ema12 === null || ema26 === null) return null;
        return { macd: ema12 - ema26, signal: ema12 - ema26, histogram: 0 };
    }

    analyzeVolume(candles) {
        if (candles.length < 20) return { spike: false, ratio: 1 };
        const recentVol = candles.slice(-5).reduce((a, c) => a + c.volume, 0) / 5;
        const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
        const ratio = avgVol > 0 ? recentVol / avgVol : 1;
        return { spike: ratio > 1.5, ratio: Math.round(ratio * 100) / 100 };
    }

    detectLevels(candles) {
        if (candles.length < 20) return { support: 0, resistance: 0 };
        const recent = candles.slice(-20);
        const lows = recent.map(c => c.low).sort((a, b) => a - b);
        const highs = recent.map(c => c.high).sort((a, b) => b - a);
        let support = lows[Math.floor(lows.length * 0.1)];
        let resistance = highs[Math.floor(highs.length * 0.1)];
        // Ensure minimum spread of 0.5% between support and resistance
        const currentPrice = recent[recent.length - 1].close;
        const minSpread = currentPrice * 0.005;
        if (resistance - support < minSpread) {
            const mid = (support + resistance) / 2;
            support = mid - minSpread;
            resistance = mid + minSpread;
        }
        return { support, resistance };
    }

    calculateStrength(rsi, emaCross, volumeSpike, macd) {
        let score = 0;
        if (rsi < 30 || rsi > 70) score += 30;
        else if (rsi < 35 || rsi > 65) score += 20;
        else if (rsi < 40 || rsi > 60) score += 10;
        if (emaCross) score += 30;
        if (volumeSpike) score += 20;
        if (macd && Math.abs(macd.macd) > 0) score += 20;
        const percentage = score;
        if (percentage >= 80) return { value: percentage, label: 'Muy Fuerte', risk: 'low' };
        if (percentage >= 60) return { value: percentage, label: 'Fuerte', risk: 'low' };
        if (percentage >= 40) return { value: percentage, label: 'Moderada', risk: 'medium' };
        return { value: percentage, label: 'Débil', risk: 'high' };
    }

    analyze(symbol, candles) {
        if (candles.length < 26) return null;
        const now = Date.now();
        if (this.lastSignals[symbol] && (now - this.lastSignals[symbol]) < this.cooldown) return null;

        const closes = candles.map(c => c.close);
        const rsi = this.calculateRSI(closes);
        const ema9 = this.calculateEMA(closes, 9);
        const ema21 = this.calculateEMA(closes, 21);
        const prevCloses = closes.slice(0, -1);
        const prevEma9 = this.calculateEMA(prevCloses, 9);
        const prevEma21 = this.calculateEMA(prevCloses, 21);
        const macd = this.calculateMACD(closes);
        const volume = this.analyzeVolume(candles);
        const levels = this.detectLevels(candles);

        if (rsi === null || ema9 === null || ema21 === null) return null;

        const emaCrossUp = ema9 > ema21 && prevEma9 !== null && prevEma21 !== null && prevEma9 <= prevEma21;
        const emaCrossDown = ema9 < ema21 && prevEma9 !== null && prevEma21 !== null && prevEma9 >= prevEma21;

        let direction = null;
        let reasons = [];
        let eli5Reasons = [];

        if (rsi < 35 && ema9 > ema21) {
            direction = 'BUY';
            reasons.push(`RSI sobrevendido (${rsi.toFixed(1)})`);
            eli5Reasons.push('💚 El precio bajó tanto que es como encontrar algo en oferta');
            reasons.push('EMA rápida por encima de la lenta');
            eli5Reasons.push('🏃 La corriente del río va hacia arriba con fuerza');
        } else if (emaCrossUp && rsi < 55) {
            direction = 'BUY';
            reasons.push('Cruce de EMAs alcista');
            eli5Reasons.push('🚦 El semáforo cambió a verde: la corriente del río empuja hacia arriba');
            if (volume.spike) {
                reasons.push(`Volumen alto (${volume.ratio}x)`);
                eli5Reasons.push('📢 Mucha gente está comprando, hay mucho ruido en el mercado');
            }
        } else if (rsi < 25) {
            direction = 'BUY';
            reasons.push(`RSI extremo (${rsi.toFixed(1)})`);
            eli5Reasons.push('🎯 El precio está TAN bajo que es como un resorte a punto de saltar');
        }

        if (!direction) {
            if (rsi > 70 && ema9 < ema21) {
                direction = 'SELL';
                reasons.push(`RSI sobrecomprado (${rsi.toFixed(1)})`);
                eli5Reasons.push('🔴 El precio subió demasiado, como un globo a punto de reventar');
                reasons.push('EMA rápida por debajo de la lenta');
                eli5Reasons.push('⬇️ La corriente del río cambió de dirección, va hacia abajo');
            } else if (emaCrossDown && rsi > 50) {
                direction = 'SELL';
                reasons.push('Cruce de EMAs bajista');
                eli5Reasons.push('🚦 El semáforo cambió a rojo: la corriente del río empuja hacia abajo');
                if (volume.spike) {
                    reasons.push(`Volumen alto (${volume.ratio}x)`);
                    eli5Reasons.push('📢 Mucha gente está vendiendo, hay pánico en el mercado');
                }
            } else if (rsi > 80) {
                direction = 'SELL';
                reasons.push(`RSI extremo (${rsi.toFixed(1)})`);
                eli5Reasons.push('🎈 El globo está SUPER inflado, puede reventar en cualquier momento');
            }
        }

        if (!direction) return null;

        const emaCross = emaCrossUp || emaCrossDown;
        const strength = this.calculateStrength(rsi, emaCross, volume.spike, macd);
        const currentPrice = closes[closes.length - 1];

        let riskLevel = 'yellow';
        if (strength.value >= 70 && volume.ratio > 1.3) riskLevel = 'green';
        else if (strength.value < 40) riskLevel = 'red';

        this.lastSignals[symbol] = now;

        return {
            id: `${symbol}_${now}`,
            symbol: symbol.replace('usdt', '').toUpperCase() + '/USDT',
            symbolRaw: symbol,
            direction,
            price: currentPrice,
            rsi: Math.round(rsi * 10) / 10,
            ema9: Math.round(ema9 * 100) / 100,
            ema21: Math.round(ema21 * 100) / 100,
            macd: macd ? Math.round(macd.macd * 100) / 100 : 0,
            volume: volume.ratio,
            volumeSpike: volume.spike,
            support: Math.round(levels.support * 100) / 100,
            resistance: Math.round(levels.resistance * 100) / 100,
            strength,
            riskLevel,
            reasons,
            eli5Reasons,
            eli5Summary: direction === 'BUY'
                ? '🟢 Parece buen momento para comprar. El precio está bajo y las señales dicen que puede subir.'
                : '🔴 Parece buen momento para vender. El precio está alto y las señales dicen que puede bajar.',
            timestamp: now,
            expired: false,
            aiValidated: false,
            aiComment: 'Módulo de IA pendiente de configurar'
        };
    }
}
