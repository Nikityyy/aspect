export function makeResultPng(snapshot, t, lang) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1500;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');

      const styles = getComputedStyle(document.documentElement);
      const color = name => styles.getPropertyValue(`--${name}`).trim();
      const font = styles.getPropertyValue('--font').trim() || 'system-ui, sans-serif';
      const palette = {
        background: color('background'),
        surface: color('surface'),
        ink: color('on-surface'),
        muted: color('on-surface-variant'),
        primary: color('primary'),
        outline: color('outline-variant'),
        track: color('surface-container-high'),
      };
      const setFont = (weight, size) => { ctx.font = `${weight} ${size}px ${font}`; };
      const roundedRect = (x, y, width, height, radius) => {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
      };

      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = palette.surface;
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2;
      roundedRect(48, 48, 1104, 1404, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = palette.primary;
      roundedRect(48, 48, 12, 1404, [28, 0, 0, 28]);
      ctx.fill();

      ctx.fillStyle = palette.ink;
      setFont(700, 30);
      ctx.fillText('ASPECT', 96, 116);
      ctx.fillStyle = palette.muted;
      setFont(500, 20);
      ctx.fillText(t('export.subtitle'), 235, 116);
      ctx.textAlign = 'right';
      ctx.fillText(new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(new Date(snapshot.completedAt)), 1090, 116);
      ctx.textAlign = 'left';

      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(96, 148);
      ctx.lineTo(1090, 148);
      ctx.stroke();

      ctx.fillStyle = palette.ink;
      setFont(700, 57);
      const title = t(`results.${snapshot.classification}`);
      ctx.fillText(title, 96, 244, 990);
      ctx.fillStyle = palette.primary;
      setFont(600, 21);
      ctx.fillText(t('export.notDiagnosis'), 96, 292);
      ctx.fillStyle = palette.muted;
      setFont(500, 20);
      ctx.fillText(t('export.profile'), 96, 354);

      const keys = [
        'socialReciprocity', 'nonverbalCommunication', 'relationships',
        'repetitiveBehaviour', 'sameness', 'focusedInterests', 'sensory',
        'developmentChildhood', 'masking', 'functionalImpact',
      ];
      let y = 414;
      for (const key of keys) {
        const score = snapshot.domains?.[key]?.score;
        ctx.fillStyle = palette.ink;
        setFont(600, 18);
        ctx.fillText(t(`domain.${key}`), 96, y, 360);
        ctx.fillStyle = palette.track;
        roundedRect(480, y - 16, 500, 14, 7);
        ctx.fill();
        if (score !== null && score !== undefined) {
          ctx.fillStyle = palette.primary;
          roundedRect(480, y - 16, 500 * score / 100, 14, 7);
          ctx.fill();
        }
        ctx.fillStyle = palette.ink;
        setFont(700, 17);
        ctx.textAlign = 'right';
        ctx.fillText(score === null || score === undefined ? t('export.noScore') : String(Math.round(score)), 1085, y, 76);
        ctx.textAlign = 'left';
        y += 68;
      }

      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(96, 1130);
      ctx.lineTo(1090, 1130);
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      setFont(700, 22);
      ctx.fillText(t('export.responseQuality'), 96, 1180);
      setFont(600, 22);
      ctx.fillText(t(`results.quality.${snapshot.quality?.level || 'limited'}`), 390, 1180);
      ctx.fillStyle = palette.muted;
      setFont(500, 18);
      ctx.fillText(t('export.model'), 96, 1250, 990);
      ctx.fillStyle = palette.ink;
      setFont(700, 21);
      ctx.fillText(t('export.disclaimer'), 96, 1320, 990);

      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}
