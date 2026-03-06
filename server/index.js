const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = process.env.PORT || 8787; // unified port

// Create temp dir for clips
const CLIPS_DIR = path.join(__dirname, 'clips');
if (!fs.existsSync(CLIPS_DIR)) fs.mkdirSync(CLIPS_DIR, { recursive: true });

// Inject Cross-Origin Isolation headers for FFmpeg WASM SharedArrayBuffer
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

app.use(cors());
app.use(express.json());
app.use('/clips', express.static(CLIPS_DIR));

// Serve frontend from parent directory
app.use(express.static(path.join(__dirname, '..')));

// --- Helper: Extract YouTube video ID ---
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// --- Helper: Format seconds to HH:MM:SS ---
function secondsToHMS(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}



// --- POST /api/clip ---
app.post('/api/clip', async (req, res) => {
    const { url, start, end, label } = req.body;

    if (!url || start === undefined || end === undefined) {
        return res.status(400).json({ error: 'url, start, dan end diperlukan' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'URL YouTube tidak valid' });

    const clipId = Date.now().toString(36);
    const safeLabel = (label || 'clip').replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim().replace(/\s+/g, '_').substring(0, 50);
    const outputFilename = `${clipId}_${safeLabel}.mp4`;
    const outputPath = path.join(CLIPS_DIR, outputFilename);

    try {
        const ytdl = require('@distube/ytdl-core');

        const startSecs = parseFloat(start);
        const endSecs = parseFloat(end);
        const duration = endSecs - startSecs;

        if (duration <= 0) {
            return res.status(400).json({ error: 'Durasi clip harus lebih dari 0 detik' });
        }

        console.log(`Clipping: videoId=${videoId}, start=${startSecs}, end=${endSecs}, duration=${duration}s`);

        // Get video stream from ytdl-core
        const videoStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            quality: 'highestvideo',
            filter: 'videoandaudio',
        });

        await new Promise((resolve, reject) => {
            ffmpeg(videoStream)
                .setStartTime(startSecs)
                .setDuration(duration)
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-preset fast',
                    '-crf 23',
                    '-movflags +faststart',
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // Auto-delete after 15 minutes
        setTimeout(() => {
            try { fs.unlinkSync(outputPath); } catch (_) { }
        }, 15 * 60 * 1000);

        res.json({
            success: true,
            downloadUrl: `/clips/${outputFilename}`,
            filename: outputFilename,
        });
    } catch (err) {
        console.error('Clip error:', err);
        if (fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch (_) { }
        }
        res.status(500).json({ error: 'Gagal memotong video: ' + err.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🎬 SiniDipotongin Server running on http://localhost:${PORT}`);
});
