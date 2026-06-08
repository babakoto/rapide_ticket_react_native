import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  PanResponder,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

type Tool = 'pen' | 'arrow' | 'rect';
type StrokeColor = string;

interface Point { x: number; y: number }

interface Stroke {
  tool: Tool;
  color: StrokeColor;
  strokeWidth: number;
  points: Point[];  // for pen: all points; for arrow/rect: [start, end]
}

interface Props {
  screenshotUri: string;
  onDone: (annotatedUri: string) => void;
  onCancel: () => void;
}

const COLORS: StrokeColor[] = ['#FF3B30', '#FF9F0A', '#FFD60A', '#30D158', '#0A84FF', '#FFFFFF'];
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pen', label: '✏️' },
  { id: 'arrow', label: '➜' },
  { id: 'rect', label: '⬜' },
];

/** Renders a single line segment between two points */
const LineSegment: React.FC<{
  p1: Point; p2: Point; color: string; width: number;
}> = ({ p1, p2, color, width }) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - width / 2,
        width: length,
        height: width,
        backgroundColor: color,
        borderRadius: width / 2,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
};

/** Renders arrowhead at point p2 coming from p1 */
const ArrowHead: React.FC<{ p1: Point; p2: Point; color: string; width: number }> = ({
  p1, p2, color, width,
}) => {
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const headLen = Math.max(14, width * 4);
  const spread = Math.PI / 5;
  const h1: Point = {
    x: p2.x - headLen * Math.cos(angle - spread),
    y: p2.y - headLen * Math.sin(angle - spread),
  };
  const h2: Point = {
    x: p2.x - headLen * Math.cos(angle + spread),
    y: p2.y - headLen * Math.sin(angle + spread),
  };
  return (
    <>
      <LineSegment p1={p2} p2={h1} color={color} width={width} />
      <LineSegment p1={p2} p2={h2} color={color} width={width} />
    </>
  );
};

/** Renders a completed stroke */
const StrokeView: React.FC<{ stroke: Stroke }> = ({ stroke }) => {
  const { tool, color, strokeWidth, points } = stroke;
  if (points.length < 2) return null;

  if (tool === 'pen') {
    return (
      <>
        {points.slice(0, -1).map((p, i) => (
          <LineSegment key={i} p1={p} p2={points[i + 1]} color={color} width={strokeWidth} />
        ))}
      </>
    );
  }

  const start = points[0];
  const end = points[points.length - 1];

  if (tool === 'arrow') {
    return (
      <>
        <LineSegment p1={start} p2={end} color={color} width={strokeWidth} />
        <ArrowHead p1={start} p2={end} color={color} width={strokeWidth} />
      </>
    );
  }

  if (tool === 'rect') {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    return (
      <View
        style={{
          position: 'absolute',
          left,
          top,
          width: w,
          height: h,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRadius: 2,
        }}
      />
    );
  }
  return null;
};

export const AnnotationEditor: React.FC<Props> = ({ screenshotUri, onDone, onCancel }) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('arrow');
  const [activeColor, setActiveColor] = useState<StrokeColor>('#FF3B30');
  const [strokeWidth] = useState(3);
  const canvasRef = useRef<View>(null);

  const createPanResponder = useCallback(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const newStroke: Stroke = {
          tool: activeTool,
          color: activeColor,
          strokeWidth,
          points: [{ x: locationX, y: locationY }],
        };
        setCurrentStroke(newStroke);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentStroke((prev) => {
          if (!prev) return null;
          if (prev.tool === 'pen') {
            return { ...prev, points: [...prev.points, { x: locationX, y: locationY }] };
          }
          // arrow/rect: only keep start + current
          return { ...prev, points: [prev.points[0], { x: locationX, y: locationY }] };
        });
      },
      onPanResponderRelease: () => {
        if (currentStroke && currentStroke.points.length >= 2) {
          setStrokes((prev) => [...prev, currentStroke]);
        }
        setCurrentStroke(null);
      },
    }),
    [activeTool, activeColor, strokeWidth, currentStroke]
  );

  const panResponder = createPanResponder();

  const handleUndo = () => setStrokes((prev) => prev.slice(0, -1));

  const handleDone = async () => {
    try {
      if (!canvasRef.current) { onDone(screenshotUri); return; }
      const uri = await captureRef(canvasRef, { format: 'png', quality: 0.9 });
      onDone(uri);
    } catch {
      onDone(screenshotUri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={onCancel}>
          <Text style={styles.toolbarBtnText}>Annuler</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Annoter</Text>
        <TouchableOpacity style={[styles.toolbarBtn, styles.doneBtn]} onPress={handleDone}>
          <Text style={[styles.toolbarBtnText, { color: '#5E5CE6', fontWeight: '700' }]}>Terminé</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View ref={canvasRef} style={styles.canvas} collapsable={false}>
        <Image source={{ uri: screenshotUri }} style={styles.screenshot} resizeMode="contain" />
        {/* Completed strokes */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {strokes.map((s, i) => <StrokeView key={i} stroke={s} />)}
          {currentStroke && <StrokeView stroke={currentStroke} />}
        </View>
        {/* Touch area */}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Tools */}
        <View style={styles.toolRow}>
          {TOOLS.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.toolBtn, activeTool === t.id && styles.toolBtnActive]}
              onPress={() => setActiveTool(t.id)}
            >
              <Text style={styles.toolBtnText}>{t.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.toolBtn, strokes.length === 0 && styles.toolBtnDisabled]}
            onPress={handleUndo}
            disabled={strokes.length === 0}
          >
            <Text style={styles.toolBtnText}>↩</Text>
          </TouchableOpacity>
        </View>

        {/* Colors */}
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                activeColor === c && styles.colorDotActive,
              ]}
              onPress={() => setActiveColor(c)}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 12,
    paddingBottom: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  toolbarTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toolbarBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  doneBtn: {},
  toolbarBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  canvas: { flex: 1, backgroundColor: '#000' },
  screenshot: { flex: 1 },
  controls: {
    backgroundColor: '#111',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 24,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: 'rgba(94,92,230,0.35)', borderWidth: 1.5, borderColor: '#5E5CE6' },
  toolBtnDisabled: { opacity: 0.3 },
  toolBtnText: { fontSize: 20, color: '#fff' },
  separator: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
});
