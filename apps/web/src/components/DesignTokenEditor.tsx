import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTokens, saveTokens } from '../providers/registry';
import { Icon } from './Icon';

interface TypeScaleEntry {
  role: string;
  size: number;
  weight: number;
  lineHeight: number;
  mono?: boolean;
}

interface Tokens {
  meta: { name: string; description?: string };
  colors: Record<string, string>;
  typography: {
    fontFamily: string;
    fontFamilyMono: string;
    scale: TypeScaleEntry[];
  };
  spacing: number[];
  radii: Record<string, number>;
  shadows: Record<string, string>;
}

type Tab = 'colors' | 'typography' | 'spacing' | 'preview';

const COLOR_LABELS: Record<string, string> = {
  primary: 'Primary',
  primaryDark: 'Primary Dark',
  primaryLight: 'Primary Light',
  primarySubtle: 'Primary Subtle',
  secondary: 'Secondary',
  secondaryDark: 'Secondary Dark',
  success: 'Success',
  successBg: 'Success Background',
  error: 'Error',
  textPrimary: 'Text Primary',
  textSecondary: 'Text Secondary',
  textTertiary: 'Text Tertiary',
  black: 'Black',
  white: 'White',
  background: 'Background',
  backgroundAlt: 'Background Alt',
  backgroundSubtle: 'Background Subtle',
  backgroundLight: 'Background Light',
  border: 'Border',
};

interface Props {
  id: string;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}

export function DesignTokenEditor({ id, title, onClose, onSaved }: Props) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [tab, setTab] = useState<Tab>('colors');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTokens(id).then((t) => {
      setTokens(t as Tokens | null);
      setLoading(false);
    });
  }, [id]);

  const setColor = useCallback((key: string, value: string) => {
    setTokens((prev) => {
      if (!prev) return prev;
      return { ...prev, colors: { ...prev.colors, [key]: value } };
    });
    setSaved(false);
  }, []);

  const setTypoField = useCallback((field: 'fontFamily' | 'fontFamilyMono', value: string) => {
    setTokens((prev) => {
      if (!prev) return prev;
      return { ...prev, typography: { ...prev.typography, [field]: value } };
    });
    setSaved(false);
  }, []);

  const setScaleEntry = useCallback((index: number, field: keyof TypeScaleEntry, value: string | number | boolean) => {
    setTokens((prev) => {
      if (!prev) return prev;
      const scale = prev.typography.scale.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      return { ...prev, typography: { ...prev.typography, scale } };
    });
    setSaved(false);
  }, []);

  const setRadius = useCallback((key: string, value: number) => {
    setTokens((prev) => {
      if (!prev) return prev;
      return { ...prev, radii: { ...prev.radii, [key]: value } };
    });
    setSaved(false);
  }, []);

  const setSpacingValue = useCallback((index: number, value: number) => {
    setTokens((prev) => {
      if (!prev) return prev;
      const spacing = [...prev.spacing];
      spacing[index] = value;
      return { ...prev, spacing };
    });
    setSaved(false);
  }, []);

  async function handleSave() {
    if (!tokens) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveTokens(id, tokens as unknown as Record<string, unknown>);
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dte-wrap">
        <div className="dte-header">
          <button type="button" className="ghost dte-back" onClick={onClose}>
            <Icon name="chevron-left" size={14} />
            <span>Back</span>
          </button>
          <h3 className="dte-title">Visual Editor — {title}</h3>
        </div>
        <p className="dte-loading">Loading tokens…</p>
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="dte-wrap">
        <div className="dte-header">
          <button type="button" className="ghost dte-back" onClick={onClose}>
            <Icon name="chevron-left" size={14} />
            <span>Back</span>
          </button>
          <h3 className="dte-title">Visual Editor — {title}</h3>
        </div>
        <p className="dte-loading">No tokens.json found for this design system. Create one to use the visual editor.</p>
      </div>
    );
  }

  return (
    <div className="dte-wrap">
      <div className="dte-header">
        <button type="button" className="ghost dte-back" onClick={onClose}>
          <Icon name="chevron-left" size={14} />
          <span>Back</span>
        </button>
        <h3 className="dte-title">Visual Editor — {title}</h3>
        <div className="dte-header-actions">
          {saved ? <span className="ds-form-saved">Saved ✓</span> : null}
          <button type="button" className="primary dte-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error ? <p className="ds-manager-error">{error}</p> : null}

      <div className="dte-tabs">
        {(['colors', 'typography', 'spacing', 'preview'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`dte-tab${tab === t ? ' dte-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="dte-body">
        {tab === 'colors' && (
          <ColorsTab colors={tokens.colors} onChange={setColor} />
        )}
        {tab === 'typography' && (
          <TypographyTab
            typography={tokens.typography}
            onFontChange={setTypoField}
            onScaleChange={setScaleEntry}
          />
        )}
        {tab === 'spacing' && (
          <SpacingTab
            spacing={tokens.spacing}
            radii={tokens.radii}
            onSpacingChange={setSpacingValue}
            onRadiusChange={setRadius}
          />
        )}
        {tab === 'preview' && (
          <PreviewTab tokens={tokens} />
        )}
      </div>
    </div>
  );
}

function ColorsTab({
  colors,
  onChange,
}: {
  colors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="dte-colors">
      {Object.entries(colors).map(([key, value]) => (
        <ColorRow key={key} tokenKey={key} value={value} onChange={onChange} />
      ))}
    </div>
  );
}

function ColorRow({
  tokenKey,
  value,
  onChange,
}: {
  tokenKey: string;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const [hex, setHex] = useState(value);
  const [hexError, setHexError] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHex(value); }, [value]);

  function handleHexInput(raw: string) {
    setHex(raw);
    const normalized = raw.startsWith('#') ? raw : '#' + raw;
    const valid = /^#[0-9a-fA-F]{6}$/.test(normalized);
    setHexError(!valid);
    if (valid) onChange(tokenKey, normalized);
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setHex(v);
    setHexError(false);
    onChange(tokenKey, v);
  }

  return (
    <div className="dte-color-row">
      <button
        type="button"
        className="dte-swatch"
        style={{ background: value }}
        onClick={() => pickerRef.current?.click()}
        title="Pick color"
      />
      <input
        ref={pickerRef}
        type="color"
        className="dte-color-picker"
        value={value}
        onChange={handlePickerChange}
      />
      <span className="dte-color-label">{COLOR_LABELS[tokenKey] ?? tokenKey}</span>
      <input
        type="text"
        className={`dte-hex-input${hexError ? ' dte-hex-error' : ''}`}
        value={hex}
        onChange={(e) => handleHexInput(e.target.value)}
        spellCheck={false}
        maxLength={7}
      />
    </div>
  );
}

function TypographyTab({
  typography,
  onFontChange,
  onScaleChange,
}: {
  typography: Tokens['typography'];
  onFontChange: (field: 'fontFamily' | 'fontFamilyMono', value: string) => void;
  onScaleChange: (index: number, field: keyof TypeScaleEntry, value: string | number | boolean) => void;
}) {
  return (
    <div className="dte-typography">
      <div className="dte-typo-fonts">
        <label className="ds-form-label">
          Primary font family
          <input
            className="ds-form-input"
            value={typography.fontFamily}
            onChange={(e) => onFontChange('fontFamily', e.target.value)}
          />
        </label>
        <label className="ds-form-label">
          Monospace font family
          <input
            className="ds-form-input"
            value={typography.fontFamilyMono}
            onChange={(e) => onFontChange('fontFamilyMono', e.target.value)}
          />
        </label>
      </div>

      <h4 className="dte-section-label">Type scale</h4>
      <div className="dte-scale-table">
        <div className="dte-scale-head">
          <span>Role</span>
          <span>Size (px)</span>
          <span>Weight</span>
          <span>Line height (px)</span>
          <span>Mono</span>
        </div>
        {typography.scale.map((entry, i) => (
          <div key={i} className="dte-scale-row">
            <input
              className="dte-scale-cell dte-scale-role"
              value={entry.role}
              onChange={(e) => onScaleChange(i, 'role', e.target.value)}
            />
            <input
              type="number"
              className="dte-scale-cell dte-scale-num"
              value={entry.size}
              min={8}
              max={200}
              onChange={(e) => onScaleChange(i, 'size', Number(e.target.value))}
            />
            <select
              className="dte-scale-cell dte-scale-weight"
              value={entry.weight}
              onChange={(e) => onScaleChange(i, 'weight', Number(e.target.value))}
            >
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <input
              type="number"
              className="dte-scale-cell dte-scale-num"
              value={entry.lineHeight}
              min={8}
              max={300}
              onChange={(e) => onScaleChange(i, 'lineHeight', Number(e.target.value))}
            />
            <input
              type="checkbox"
              className="dte-scale-mono"
              checked={!!entry.mono}
              onChange={(e) => onScaleChange(i, 'mono', e.target.checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpacingTab({
  spacing,
  radii,
  onSpacingChange,
  onRadiusChange,
}: {
  spacing: number[];
  radii: Record<string, number>;
  onSpacingChange: (index: number, value: number) => void;
  onRadiusChange: (key: string, value: number) => void;
}) {
  return (
    <div className="dte-spacing">
      <h4 className="dte-section-label">Spacing scale</h4>
      <div className="dte-spacing-chips">
        {spacing.map((val, i) => (
          <div key={i} className="dte-spacing-chip">
            <div className="dte-spacing-bar" style={{ width: Math.min(val, 80) }} />
            <input
              type="number"
              className="dte-spacing-input"
              value={val}
              min={0}
              max={320}
              onChange={(e) => onSpacingChange(i, Number(e.target.value))}
            />
            <span className="dte-spacing-unit">px</span>
          </div>
        ))}
      </div>

      <h4 className="dte-section-label">Border radii</h4>
      <div className="dte-radii">
        {Object.entries(radii).map(([key, val]) => (
          <div key={key} className="dte-radius-row">
            <div
              className="dte-radius-preview"
              style={{ borderRadius: Math.min(val, 24) }}
            />
            <span className="dte-radius-label">{key}</span>
            <input
              type="number"
              className="dte-spacing-input"
              value={val}
              min={0}
              max={800}
              onChange={(e) => onRadiusChange(key, Number(e.target.value))}
            />
            <span className="dte-spacing-unit">px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewTab({ tokens }: { tokens: Tokens }) {
  const c = tokens.colors;
  const body = tokens.typography.scale.find((s) => s.role === 'Body');
  const h1 = tokens.typography.scale[0];
  const h3 = tokens.typography.scale[2];
  const label = tokens.typography.scale.find((s) => s.role === 'UI Label');

  const ff = tokens.typography.fontFamily;
  const btnRadius = tokens.radii.button ?? 40;
  const cardRadius = tokens.radii.card ?? 16;
  const inputRadius = tokens.radii.input ?? 8;

  return (
    <div className="dte-preview" style={{ fontFamily: ff, color: c.textPrimary, background: c.background }}>
      <div className="dte-preview-section" style={{ background: c.background }}>
        <div style={{ fontSize: h1?.size, fontWeight: h1?.weight, lineHeight: (h1?.lineHeight ?? 56) + 'px', marginBottom: 16 }}>
          Platform Heading
        </div>
        <div style={{ fontSize: body?.size, fontWeight: body?.weight, lineHeight: (body?.lineHeight ?? 28) + 'px', color: c.textSecondary, marginBottom: 24 }}>
          Supporting body text that describes the feature or content in more detail.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              background: c.primary,
              color: c.white,
              border: 'none',
              borderRadius: btnRadius,
              padding: '12px 32px',
              fontSize: label?.size,
              fontWeight: label?.weight,
              fontFamily: ff,
              cursor: 'default',
            }}
          >
            Primary Action
          </button>
          <button
            type="button"
            style={{
              background: 'transparent',
              color: c.textPrimary,
              border: `1px solid ${c.border}`,
              borderRadius: btnRadius,
              padding: '12px 32px',
              fontSize: label?.size,
              fontWeight: label?.weight,
              fontFamily: ff,
              cursor: 'default',
            }}
          >
            Secondary
          </button>
          <button
            type="button"
            style={{
              background: c.secondary,
              color: c.textPrimary,
              border: 'none',
              borderRadius: btnRadius,
              padding: '12px 32px',
              fontSize: label?.size,
              fontWeight: label?.weight,
              fontFamily: ff,
              cursor: 'default',
            }}
          >
            Accent
          </button>
        </div>
      </div>

      <div className="dte-preview-section" style={{ background: c.backgroundLight }}>
        <div style={{ fontSize: h3?.size, fontWeight: h3?.weight, lineHeight: (h3?.lineHeight ?? 32) + 'px', marginBottom: 16 }}>
          Cards & Inputs
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{
            background: c.background,
            border: `1px solid ${c.border}`,
            borderRadius: cardRadius,
            padding: '24px 32px',
            minWidth: 200,
            flex: '1 1 200px',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Card title</div>
            <div style={{ color: c.textSecondary, fontSize: 14 }}>Card description text.</div>
          </div>
          <div style={{
            background: c.background,
            borderRadius: cardRadius,
            padding: '24px 32px',
            minWidth: 200,
            flex: '1 1 200px',
            boxShadow: tokens.shadows.raised,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Elevated card</div>
            <div style={{ color: c.textSecondary, fontSize: 14 }}>With raised shadow.</div>
          </div>
        </div>
        <div style={{ marginTop: 16, maxWidth: 320 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.textSecondary, marginBottom: 8 }}>Label</div>
          <input
            readOnly
            value="Input field value"
            style={{
              display: 'block',
              width: '100%',
              background: c.background,
              border: `1px solid ${c.border}`,
              borderRadius: inputRadius,
              padding: '12px 16px',
              fontSize: 16,
              fontFamily: ff,
              color: c.textPrimary,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div className="dte-preview-section">
        <div style={{ fontSize: h3?.size, fontWeight: h3?.weight, lineHeight: (h3?.lineHeight ?? 32) + 'px', marginBottom: 16 }}>
          Color Palette
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(c).map(([key, val]) => (
            <div key={key} style={{ textAlign: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: val,
                border: `1px solid ${c.border}`,
                marginBottom: 4,
              }} />
              <div style={{ fontSize: 10, color: c.textTertiary, maxWidth: 44, wordBreak: 'break-word' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
