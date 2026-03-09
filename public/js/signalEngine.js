// ============================================
// AlphaSignal Pro - Motor de Señales v3.0
// RSI + EMA(9/21/50) + ATR + MACD Real + Volume
// + Bollinger Bands Squeeze + Market Structure
// Filtro de tendencia + volatilidad dinámica
// ============================================

class SignalEngine {
    constructor() {
        this.lastSignals = {};
        this.cooldown = 60000;
    }

    // ==================== INDICADORES ====================

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

    calculateEMASeries(closes, period) {
        if (closes.length < period) return [];
        const multiplier = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const series = [ema];
        for (let i = period; i < closes.length; i++) {
            ema = (closes[i] - ema) * multiplier + ema;
            series.push(ema);
        }
        return series;
    }

    calculateMACD(closes) {
        if (closes.length < 35) return null;
        const ema12Series = this.calculateEMASeries(closes, 12);
        const ema26Series = this.calculateEMASeries(closes, 26);
        if (ema12Series.length === 0 || ema26Series.length === 0) return null;
        // Align series: ema12 starts at index 12, ema26 at index 26
        // MACD line values start where both exist
        const offset = 26 - 12; // ema12 has 14 more values
        const macdLine = [];
        const len26 = ema26Series.length;
        for (let i = 0; i < len26; i++) {
            macdLine.push(ema12Series[i + offset] - ema26Series[i]);
        }
        // Signal line = EMA(9) of MACD line
        if (macdLine.length < 9) return { macd: macdLine[macdLine.length - 1] || 0, signal: 0, histogram: 0 };
        const signalSeries = this.calculateEMASeries(macdLine, 9);
        const macdValue = macdLine[macdLine.length - 1];
        const signalValue = signalSeries[signalSeries.length - 1];
        const histogram = macdValue - signalValue;
        // Previous values for crossover detection
        const prevMacd = macdLine.length >= 2 ? macdLine[macdLine.length - 2] : macdValue;
        const prevSignal = signalSeries.length >= 2 ? signalSeries[signalSeries.length - 2] : signalValue;
        return {
            macd: macdValue,
            signal: signalValue,
            histogram,
            crossUp: prevMacd <= prevSignal && macdValue > signalValue,
            crossDown: prevMacd >= prevSignal && macdValue < signalValue,
            bullish: macdValue > signalValue,
            bearish: macdValue < signalValue
        };
    }

    calculateATR(candles, period = 14) {
        if (candles.length < period + 1) return null;
        const trueRanges = [];
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
        }
        if (trueRanges.length < period) return null;
        let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < trueRanges.length; i++) {
            atr = (atr * (period - 1) + trueRanges[i]) / period;
        }
        return atr;
    }

    calculateBollingerBands(closes, period = 20, stdDevMult = 2) {
        if (closes.length < period) return null;
        const recent = closes.slice(-period);
        const sma = recent.reduce((a, b) => a + b, 0) / period;
        const variance = recent.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upper = sma + stdDevMult * stdDev;
        const lower = sma - stdDevMult * stdDev;
        const width = (upper - lower) / sma;
        // Calculate previous BB width to detect squeeze release
        let prevWidth = width;
        if (closes.length >= period + 5) {
            const prev = closes.slice(-(period + 5), -5);
            const prevSma = prev.reduce((a, b) => a + b, 0) / period;
            const prevVar = prev.reduce((sum, val) => sum + Math.pow(val - prevSma, 2), 0) / period;
            const prevStd = Math.sqrt(prevVar);
            prevWidth = ((prevSma + stdDevMult * prevStd) - (prevSma - stdDevMult * prevStd)) / prevSma;
        }
        const currentPrice = closes[closes.length - 1];
        return {
            upper, lower, sma, width,
            squeeze: width < 0.02,
            squeezeRelease: prevWidth < 0.02 && width >= 0.02,
            priceAboveMid: currentPrice > sma,
            priceBelowMid: currentPrice < sma,
            nearUpper: currentPrice > upper * 0.998,
            nearLower: currentPrice < lower * 1.002
        };
    }

    detectMarketStructure(candles) {
        if (candles.length < 20) return { trend: 'neutral', breakout: null };
        // Find swing highs and lows using 5-candle lookback
        const swingHighs = [];
        const swingLows = [];
        for (let i = 2; i < candles.length - 2; i++) {
            const h = candles[i].high;
            if (h > candles[i-1].high && h > candles[i-2].high && h > candles[i+1].high && h > candles[i+2].high) {
                swingHighs.push({ price: h, index: i });
            }
            const l = candles[i].low;
            if (l < candles[i-1].low && l < candles[i-2].low && l < candles[i+1].low && l < candles[i+2].low) {
                swingLows.push({ price: l, index: i });
            }
        }
        if (swingHighs.length < 2 || swingLows.length < 2) return { trend: 'neutral', breakout: null };
        const lastH = swingHighs[swingHighs.length - 1];
        const prevH = swingHighs[swingHighs.length - 2];
        const lastL = swingLows[swingLows.length - 1];
        const prevL = swingLows[swingLows.length - 2];
        // Determine structure
        const higherHigh = lastH.price > prevH.price;
        const higherLow = lastL.price > prevL.price;
        const lowerHigh = lastH.price < prevH.price;
        const lowerLow = lastL.price < prevL.price;
        let trend = 'neutral';
        if (higherHigh && higherLow) trend = 'bullish';
        else if (lowerHigh && lowerLow) trend = 'bearish';
        // Detect structure break
        const currentPrice = candles[candles.length - 1].close;
        let breakout = null;
        if (currentPrice > lastH.price && lowerHigh) breakout = 'bullish_break';
        if (currentPrice < lastL.price && higherLow) breakout = 'bearish_break';
        return { trend, breakout, higherHigh, higherLow, lowerHigh, lowerLow };
    }

    analyzeVolume(candles) {
        if (candles.length < 20) return { spike: false, ratio: 1 };
        const recentVol = candles.slice(-5).reduce((a, c) => a + c.volume, 0) / 5;
        const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
        const ratio = avgVol > 0 ? recentVol / avgVol : 1;
        return { spike: ratio > 1.5, ratio: Math.round(ratio * 100) / 100 };
    }

    detectLevels(candles, atr) {
        if (candles.length < 20) return { support: 0, resistance: 0 };
        const recent = candles.slice(-20);
        const lows = recent.map(c => c.low).sort((a, b) => a - b);
        const highs = recent.map(c => c.high).sort((a, b) => b - a);
        let support = lows[Math.floor(lows.length * 0.1)];
        let resistance = highs[Math.floor(highs.length * 0.1)];
        // Use ATR for minimum spread if available, otherwise 0.5% of price
        const currentPrice = recent[recent.length - 1].close;
        const minSpread = atr ? atr * 1.5 : currentPrice * 0.005;
        if (resistance - support < minSpread) {
            const mid = (support + resistance) / 2;
            support = mid - minSpread / 2;
            resistance = mid + minSpread / 2;
        }
        return { support, resistance };
    }

    // ==================== STRENGTH ====================

    calculateStrength(rsi, emaCross, volumeSpike, macd, trendAligned, bb, structure) {
        let score = 0;
        // RSI in extreme zone (max 20)
        if (rsi < 25 || rsi > 75) score += 20;
        else if (rsi < 30 || rsi > 70) score += 15;
        else if (rsi < 35 || rsi > 65) score += 10;
        else if (rsi < 40 || rsi > 60) score += 5;
        // EMA cross (max 15)
        if (emaCross) score += 15;
        // Volume confirmation (max 10)
        if (volumeSpike) score += 10;
        // MACD real confirmation (max 20)
        if (macd) {
            if (macd.crossUp || macd.crossDown) score += 20;
            else if (Math.abs(macd.histogram) > 0) score += 8;
        }
        // Trend alignment with EMA50 (max 10)
        if (trendAligned) score += 10;
        // Bollinger Bands (max 15)
        if (bb) {
            if (bb.squeezeRelease) score += 15;
            else if (bb.squeeze) score += 8;
        }
        // Market Structure (max 10)
        if (structure) {
            if (structure.breakout) score += 10;
            else if (structure.trend !== 'neutral') score += 5;
        }
        const percentage = Math.min(score, 100);
        if (percentage >= 75) return { value: percentage, label: 'Muy Fuerte', risk: 'low' };
        if (percentage >= 55) return { value: percentage, label: 'Fuerte', risk: 'low' };
        if (percentage >= 35) return { value: percentage, label: 'Moderada', risk: 'medium' };
        return { value: percentage, label: 'Débil', risk: 'high' };
    }

    // ==================== ANÁLISIS PRINCIPAL ====================

    analyze(symbol, candles) {
        if (candles.length < 50) return null;
        const now = Date.now();
        if (this.lastSignals[symbol] && (now - this.lastSignals[symbol]) < this.cooldown) return null;

        const closes = candles.map(c => c.close);
        const rsi = this.calculateRSI(closes);
        const ema9 = this.calculateEMA(closes, 9);
        const ema21 = this.calculateEMA(closes, 21);
        const ema50 = this.calculateEMA(closes, 50);
        const prevCloses = closes.slice(0, -1);
        const prevEma9 = this.calculateEMA(prevCloses, 9);
        const prevEma21 = this.calculateEMA(prevCloses, 21);
        const macd = this.calculateMACD(closes);
        const atr = this.calculateATR(candles);
        const volume = this.analyzeVolume(candles);
        const bb = this.calculateBollingerBands(closes);
        const structure = this.detectMarketStructure(candles);
        const levels = this.detectLevels(candles, atr);

        if (rsi === null || ema9 === null || ema21 === null) return null;

        const emaCrossUp = ema9 > ema21 && prevEma9 !== null && prevEma21 !== null && prevEma9 <= prevEma21;
        const emaCrossDown = ema9 < ema21 && prevEma9 !== null && prevEma21 !== null && prevEma9 >= prevEma21;
        const currentPrice = closes[closes.length - 1];

        // Trend filter: EMA50 direction
        const trendUp = ema50 !== null && currentPrice > ema50;
        const trendDown = ema50 !== null && currentPrice < ema50;

        let direction = null;
        let reasons = [];
        let eli5Reasons = [];
        let trendAligned = false;

        // ===== BUY CONDITIONS =====
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

        // ===== SELL CONDITIONS =====
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

        // ===== BOLLINGER BANDS SQUEEZE SIGNAL =====
        if (!direction && bb) {
            if (bb.squeezeRelease && bb.priceAboveMid && rsi < 60) {
                direction = 'BUY';
                reasons.push('Squeeze de Bollinger liberado al alza');
                eli5Reasons.push('💥 El precio estaba comprimido como un resorte y ahora explota hacia arriba');
            } else if (bb.squeezeRelease && bb.priceBelowMid && rsi > 40) {
                direction = 'SELL';
                reasons.push('Squeeze de Bollinger liberado a la baja');
                eli5Reasons.push('💥 El precio estaba comprimido como un resorte y ahora cae con fuerza');
            }
        }

        // ===== STRUCTURE BREAK SIGNAL =====
        if (!direction && structure.breakout) {
            if (structure.breakout === 'bullish_break' && rsi < 65) {
                direction = 'BUY';
                reasons.push('Ruptura de estructura alcista (HH)');
                eli5Reasons.push('🏗️ El precio rompió un techo importante, camino libre hacia arriba');
            } else if (structure.breakout === 'bearish_break' && rsi > 35) {
                direction = 'SELL';
                reasons.push('Ruptura de estructura bajista (LL)');
                eli5Reasons.push('🏗️ El precio rompió un piso importante, puede seguir cayendo');
            }
        }

        if (!direction) return null;

        // ===== MACD CONFIRMATION =====
        if (macd) {
            if (direction === 'BUY' && macd.bullish) {
                reasons.push(`MACD alcista (H: ${macd.histogram.toFixed(4)})`);
                eli5Reasons.push('📊 El motor interno del precio empuja hacia arriba');
            } else if (direction === 'SELL' && macd.bearish) {
                reasons.push(`MACD bajista (H: ${macd.histogram.toFixed(4)})`);
                eli5Reasons.push('📊 El motor interno del precio empuja hacia abajo');
            }
        }

        // ===== TREND FILTER (EMA50) =====
        if (direction === 'BUY' && trendUp) {
            trendAligned = true;
            reasons.push('Tendencia mayor alcista (EMA50)');
            eli5Reasons.push('🌊 La marea grande también sube, eso es buena señal');
        } else if (direction === 'SELL' && trendDown) {
            trendAligned = true;
            reasons.push('Tendencia mayor bajista (EMA50)');
            eli5Reasons.push('🌊 La marea grande también baja, eso confirma la caída');
        } else if (ema50 !== null) {
            reasons.push('⚠ Contra-tendencia (EMA50)');
            eli5Reasons.push('⚠️ Cuidado: vas contra la corriente grande, más riesgo');
        }

        // ===== BOLLINGER BANDS CONTEXT =====
        if (bb) {
            if (bb.squeeze) {
                reasons.push('BB comprimidas (posible explosión)');
                eli5Reasons.push('🔋 Las bandas están muy juntas: se acumula energía para un movimiento fuerte');
            }
            if (direction === 'BUY' && bb.nearLower) {
                reasons.push('Precio en banda inferior de Bollinger');
                eli5Reasons.push('📉 El precio tocó el piso de las bandas, suele rebotar');
            } else if (direction === 'SELL' && bb.nearUpper) {
                reasons.push('Precio en banda superior de Bollinger');
                eli5Reasons.push('📈 El precio tocó el techo de las bandas, suele caer');
            }
        }

        // ===== MARKET STRUCTURE CONTEXT =====
        if (structure.trend !== 'neutral') {
            if (direction === 'BUY' && structure.trend === 'bullish') {
                reasons.push('Estructura de mercado alcista (HH+HL)');
                eli5Reasons.push('📐 Los techos y pisos suben, la estructura del precio confirma compra');
            } else if (direction === 'SELL' && structure.trend === 'bearish') {
                reasons.push('Estructura de mercado bajista (LH+LL)');
                eli5Reasons.push('📐 Los techos y pisos bajan, la estructura del precio confirma venta');
            }
        }

        // ===== ATR-BASED TP/SL =====
        let support = levels.support;
        let resistance = levels.resistance;
        if (atr) {
            if (direction === 'BUY') {
                support = Math.min(support, currentPrice - atr * 1.5);
                resistance = Math.max(resistance, currentPrice + atr * 2);
            } else {
                support = Math.min(support, currentPrice - atr * 2);
                resistance = Math.max(resistance, currentPrice + atr * 1.5);
            }
        }

        const emaCross = emaCrossUp || emaCrossDown;
        const strength = this.calculateStrength(rsi, emaCross, volume.spike, macd, trendAligned, bb, structure);

        // ===== RISK LEVEL =====
        let riskLevel = 'yellow';
        if (strength.value >= 65 && trendAligned && volume.ratio > 1.2) riskLevel = 'green';
        else if (strength.value < 35 || (!trendAligned && !volume.spike)) riskLevel = 'red';

        // ===== FILTER: discard weak signals without trend =====
        if (strength.value < 25) return null;

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
            ema50: ema50 ? Math.round(ema50 * 100) / 100 : null,
            macd: macd ? Math.round(macd.macd * 10000) / 10000 : 0,
            macdSignal: macd ? Math.round(macd.signal * 10000) / 10000 : 0,
            macdHistogram: macd ? Math.round(macd.histogram * 10000) / 10000 : 0,
            atr: atr ? Math.round(atr * 10000) / 10000 : 0,
            bbWidth: bb ? Math.round(bb.width * 10000) / 10000 : 0,
            bbSqueeze: bb ? bb.squeeze : false,
            structureTrend: structure.trend,
            structureBreak: structure.breakout || null,
            volume: volume.ratio,
            volumeSpike: volume.spike,
            support: Math.round(support * 100) / 100,
            resistance: Math.round(resistance * 100) / 100,
            trendAligned,
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
