import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import {
  Camera, Check, ChevronRight, Images, PenLine, Sparkles, Store, CookingPot, RotateCcw
} from 'lucide-react-native';
import { api, type Connection } from './api';
import { c } from './theme';
import {
  Button, Card, Field, Pill, PressableScale, Segmented, T
} from './ui';
import type { Meal, MealType } from './types';

type Estimate = {
  name?: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type MealInitial = {
  meal_type?: MealType;
  is_outside_food?: boolean;
  text?: string;
  startStage?: 'pick' | 'describe';
};

const mealTypes: Array<{ key: MealType; label: string }> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' }
];

const suggestions = [
  '2 rotis, 1 katori dal, 1 katori sabzi',
  '3 idlis, sambar, coconut chutney',
  '1 bowl poha, 1 cup chai',
  '150 g chicken curry, 1 katori rice',
  '1 katori curd rice'
];

type Stage = 'pick' | 'describe' | 'estimating' | 'review';

export default function MealEditor({
  connection, date, initial, meal, onDone
}: {
  connection: Connection;
  date: string;
  initial?: MealInitial;
  meal?: Meal;
  onDone: () => void;
}) {
  const uploadKey = useRef(Crypto.randomUUID());
  const assetId = useRef<string | null>(null);
  const createdDraft = useRef(false);
  const [draftId, setDraftId] = useState<number | undefined>(meal?.id);
  const [mealType, setMealType] = useState<MealType>(meal?.meal_type ?? initial?.meal_type ?? 'lunch');
  const [outside, setOutside] = useState(
    meal ? !!meal.is_outside_food : !!initial?.is_outside_food
  );
  const [description, setDescription] = useState(meal?.description ?? initial?.text ?? '');
  const [calories, setCalories] = useState(String(meal?.final_calories ?? meal?.ai_calories ?? ''));
  const [protein, setProtein] = useState(String(meal?.final_protein ?? meal?.ai_protein ?? ''));
  const [carbs, setCarbs] = useState(String(meal?.final_carbs ?? meal?.ai_carbs ?? ''));
  const [fat, setFat] = useState(String(meal?.final_fat ?? meal?.ai_fat ?? ''));
  const [stage, setStage] = useState<Stage>(
    meal ? 'review' : initial?.text || initial?.startStage === 'describe' ? 'describe' : 'pick'
  );
  const [photo, setPhoto] = useState('');
  const [result, setResult] = useState<Estimate | null>(() => {
    if (!meal) return null;
    const ingredients = Array.isArray(meal.ai_ingredients)
      ? meal.ai_ingredients
      : typeof meal.ai_ingredients === 'string'
        ? safeParse(meal.ai_ingredients)
        : [];
    return {
      name: meal.description ?? undefined,
      calories: meal.ai_calories ?? meal.final_calories ?? 0,
      protein_g: meal.ai_protein ?? meal.final_protein ?? 0,
      carbs_g: meal.ai_carbs ?? meal.final_carbs ?? 0,
      fat_g: meal.ai_fat ?? meal.final_fat ?? 0,
      ingredients,
      confidence: (meal.ai_confidence as Estimate['confidence']) ?? 'medium'
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasPhoto = !!photo || !!meal?.photo_url;
  const penalty = mealType !== 'snack' ? 8 : 0;
  const showPenalty = outside && penalty > 0;

  async function adoptPhoto(asset: { uri: string; width: number; height: number }) {
    setBusy(true);
    setError('');
    try {
      const scale = asset.width > 0 && asset.height > 0
        ? Math.min(1, 768 / Math.max(asset.width, asset.height))
        : 1;
      const context = ImageManipulator.manipulate(asset.uri);
      if (scale < 1) context.resize({ width: Math.round(asset.width * scale) });
      const resized = await context.renderAsync();
      const saved = await resized.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
      uploadKey.current = Crypto.randomUUID();
      assetId.current = null;
      if (createdDraft.current && draftId) {
        // The draft still points at the old picture — drop it and start fresh.
        await api(connection, `/api/meals/${draftId}`, 'DELETE').catch(() => {});
        createdDraft.current = false;
        setDraftId(undefined);
      }
      setResult(null);
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setPhoto(saved.uri);
      setStage('describe');
    } catch {
      setError('Couldn’t use that photo. Try a different one.');
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    setError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is off. You can pick a photo from the gallery instead.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85
      });
      const asset = result.canceled ? null : result.assets[0];
      if (asset) await adoptPhoto(asset);
    } catch {
      setError('Couldn’t open the camera. Pick a photo from the gallery instead.');
    }
  }

  async function pickFromGallery() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9
      });
      const asset = result.canceled ? null : result.assets[0];
      if (asset) await adoptPhoto(asset);
    } catch {
      setError('Couldn’t open your gallery. Try again.');
    }
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photo) return assetId.current;
    if (assetId.current) return assetId.current;
    const signed = await api<
      { provider: 'cloudinary'; asset_id: string; url: string; fields: Record<string, string> } |
      { provider: 'worker' }
    >(connection, '/api/meals/upload', 'POST', undefined, uploadKey.current);
    if (signed.provider === 'cloudinary') {
      const form = new FormData();
      Object.entries(signed.fields).forEach(([key, value]) => form.append(key, value));
      form.append('file', new File(photo));
      const response = await expoFetch(signed.url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout?.(20000)
      });
      if (!response.ok && response.status !== 409) {
        throw new Error('Couldn’t upload the photo. You can still enter the meal manually.');
      }
      assetId.current = signed.asset_id;
    } else {
      const uploaded = await api<{ asset_id: string }>(
        connection, '/api/meals/photo', 'POST', new File(photo), uploadKey.current
      );
      assetId.current = uploaded.asset_id;
    }
    return assetId.current;
  }

  async function runEstimate() {
    if (!description.trim() && !photo) {
      setError('Add a photo or describe what you ate first.');
      return;
    }
    setBusy(true);
    setError('');
    setStage('estimating');
    try {
      let estimate: Estimate;
      if (photo) {
        const asset = await uploadPhoto();
        let activeId = draftId;
        if (!activeId) {
          const draft = await api<{ meal: Meal }>(connection, '/api/meals', 'POST', {
            date,
            meal_type: mealType,
            is_outside_food: outside,
            description: description.trim(),
            asset_public_id: asset
          }, uploadKey.current + ':draft');
          activeId = draft.meal.id;
          createdDraft.current = true;
          setDraftId(activeId);
        }
        const estimated = await api<{ meal: Meal }>(connection, '/api/meals/estimate', 'POST', {
          meal_id: activeId,
          retry: !!result
        }, uploadKey.current + ':estimate');
        estimate = {
          name: estimated.meal.description ?? undefined,
          calories: estimated.meal.ai_calories ?? 0,
          protein_g: estimated.meal.ai_protein ?? 0,
          carbs_g: estimated.meal.ai_carbs ?? 0,
          fat_g: estimated.meal.ai_fat ?? 0,
          ingredients: Array.isArray(estimated.meal.ai_ingredients)
            ? estimated.meal.ai_ingredients
            : safeParse(String(estimated.meal.ai_ingredients ?? '[]')),
          confidence: (estimated.meal.ai_confidence as Estimate['confidence']) ?? 'medium'
        };
      } else {
        const parsed = await api<{ estimate: Estimate }>(connection, '/api/meals/parse', 'POST', {
          text: description.trim()
        }, uploadKey.current + ':text');
        estimate = parsed.estimate;
      }
      setResult(estimate);
      setCalories(String(Math.round(estimate.calories)));
      setProtein(String(Math.round(estimate.protein_g)));
      setCarbs(String(Math.round(estimate.carbs_g)));
      setFat(String(Math.round(estimate.fat_g)));
      setStage('review');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI couldn’t read that one. Enter a rough number instead.');
      setStage('review');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!calories.trim() || !Number.isFinite(Number(calories))) {
      setError('Enter a rough calorie number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = {
        meal_type: mealType,
        is_outside_food: outside,
        description: description.trim(),
        final_calories: Math.round(Number(calories)),
        final_protein: protein.trim() ? Number(protein) : 0,
        final_carbs: carbs.trim() ? Number(carbs) : 0,
        final_fat: fat.trim() ? Number(fat) : 0,
        confirm: true
      };
      if (draftId) {
        await api(connection, `/api/meals/${draftId}`, 'PATCH', body, uploadKey.current + ':save');
      } else {
        await api(connection, '/api/meals', 'POST', {
          date,
          meal_type: mealType,
          is_outside_food: outside,
          description: description.trim(),
          manual_calories: Math.round(Number(calories)),
          manual_protein: protein.trim() ? Number(protein) : 0,
          manual_carbs: carbs.trim() ? Number(carbs) : 0,
          manual_fat: fat.trim() ? Number(fat) : 0
        }, uploadKey.current + ':save');
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that meal.');
    } finally {
      setBusy(false);
    }
  }

  const ingredients = result?.ingredients ?? [];
  const remotePhoto = meal?.photo_url ? connection.url + meal.photo_url : '';

  return (
    <>
      {stage !== 'review' && (
        <>
          <Segmented options={mealTypes} value={mealType} onChange={setMealType} />
          <FoodSource value={outside} onChange={setOutside} penalty={penalty} />
          {showPenalty && (
            <View style={{ backgroundColor: c.warningSoft, borderRadius: 13, padding: 11 }}>
              <T variant="meta" style={{ color: c.warningInk }}>
                Outside food costs {penalty} points today. Logging it honestly still beats hiding it.
              </T>
            </View>
          )}
        </>
      )}

      {stage === 'pick' && (
        <>
          <View style={{ gap: 10 }}>
            <PickOption
              icon={<Camera size={22} color={c.primary} />}
              soft={c.primarySoft}
              title="Take a photo"
              hint="Opens your camera full screen. Keep the whole plate in frame."
              onPress={takePhoto}
              disabled={busy}
            />
            <PickOption
              icon={<Images size={22} color={c.purple} />}
              soft={c.purpleSoft}
              title="Choose from gallery"
              hint="Already snapped it? Pick the meal photo here."
              onPress={pickFromGallery}
              disabled={busy}
            />
            <PickOption
              icon={<PenLine size={22} color={c.orange} />}
              soft={c.orangeSoft}
              title="Describe it instead"
              hint="“2 rotis, dal, 30 g ghee” is enough."
              onPress={() => setStage('describe')}
              disabled={busy}
            />
          </View>
          {busy && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4 }}>
              <ActivityIndicator size="small" color={c.primary} />
              <T variant="meta" tone="muted">Preparing your photo…</T>
            </View>
          )}
          <Button label="Enter calories manually" onPress={() => setStage('review')} variant="ghost" size="sm" />
          {meal?.photo_url && (
            <Image
              source={{ uri: connection.url + meal.photo_url, headers: { Authorization: 'Bearer ' + connection.key } }}
              style={{ width: '100%', height: 190, borderRadius: 18, backgroundColor: c.soft }}
              contentFit="cover"
            />
          )}
        </>
      )}

      {stage === 'describe' && (
        <>
          {photo ? (
            <>
              <Image source={photo} style={{ width: '100%', height: 190, borderRadius: 18, backgroundColor: c.soft }} contentFit="cover" />
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Button label="Retake" onPress={takePhoto} size="sm" variant="soft" style={{ flex: 1 }} disabled={busy} icon={<Camera size={15} color={c.ink} />} />
                <Button label="Gallery" onPress={pickFromGallery} size="sm" variant="soft" style={{ flex: 1 }} disabled={busy} icon={<Images size={15} color={c.ink} />} />
              </View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <Button label="Take a photo" onPress={takePhoto} size="sm" variant="soft" style={{ flex: 1.2 }} disabled={busy} icon={<Camera size={15} color={c.ink} />} />
              <Button label="Gallery" onPress={pickFromGallery} size="sm" variant="soft" style={{ flex: 1 }} disabled={busy} icon={<Images size={15} color={c.ink} />} />
            </View>
          )}
          <Field
            label={hasPhoto ? 'Anything hidden in there? (optional)' : 'What did you eat?'}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. 2 rotis, 1 katori dal, 30 g ghee, 1 cup chai"
            maxLength={500}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {suggestions.map((suggestion) => (
              <PressableScale
                key={suggestion}
                onPress={() => setDescription(suggestion)}
                style={{ backgroundColor: c.soft, borderRadius: 999, paddingHorizontal: 12, height: 32, justifyContent: 'center' }}
              >
                <T variant="caption">{suggestion}</T>
              </PressableScale>
            ))}
          </View>
          <Button
            label={busy ? 'Reading your meal…' : 'Estimate with AI'}
            onPress={runEstimate}
            disabled={busy || (!description.trim() && !photo)}
            loading={busy}
            icon={<Sparkles size={16} color={c.white} />}
            full
            size="lg"
          />
          <Button label="Enter manually" onPress={() => setStage('review')} variant="soft" full />
        </>
      )}

      {stage === 'estimating' && (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 30 }}>
          <ActivityIndicator color={c.primary} />
          <T variant="subheading">Reading your meal…</T>
          <T variant="meta" tone="muted" align="center" style={{ maxWidth: 260 }}>
            {description || 'Checking the portions and counting the ghee.'}
          </T>
        </Card>
      )}

      {stage === 'review' && (
        <>
          {!!(photo || remotePhoto) && (
            <Image
              source={photo || remotePhoto}
              style={{ width: '100%', height: 170, borderRadius: 18, backgroundColor: c.soft }}
              contentFit="cover"
            />
          )}
          {result && result.calories > 0 ? (
            <Card style={{ gap: 12, borderColor: c.primarySoft }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pill
                  label="AI estimate"
                  tone="primary"
                  icon={<Sparkles size={12} color={c.primary} strokeWidth={2.4} />}
                />
                <Pill label={result.confidence === 'low' ? 'Rough read' : 'Looks close'} tone="soft" />
              </View>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                  <T variant="number" style={{ fontSize: 40, lineHeight: 44 }}>{Math.round(result.calories)}</T>
                  <T variant="meta" tone="muted">kcal</T>
                </View>
                <T variant="bodyStrong">
                  {result.name || (ingredients.length ? ingredients.slice(0, 3).join(', ') : 'Your meal')}
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <MacroBadge label="Protein" value={Math.round(result.protein_g)} color={c.success} />
                <MacroBadge label="Carbs" value={Math.round(result.carbs_g)} color={c.warning} />
                <MacroBadge label="Fat" value={Math.round(result.fat_g)} color={c.purple} />
              </View>
              {!!ingredients.length && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ingredients.map((item) => (
                    <Pill key={item} label={item} tone="soft" />
                  ))}
                </View>
              )}
              <T variant="caption" tone="muted">
                {result.confidence === 'low'
                  ? 'Hard to judge portions here. Tap any number to adjust.'
                  : 'Rough estimate. Tap any number to adjust.'}
              </T>
            </Card>
          ) : (
            <Card style={{ gap: 5 }}>
              <T variant="subheading">A rough estimate is fine.</T>
              <T variant="meta" tone="muted">Enter what you remember. You can edit it later.</T>
            </Card>
          )}

          <Segmented options={mealTypes} value={mealType} onChange={setMealType} />
          <FoodSource value={outside} onChange={setOutside} penalty={penalty} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Calories" value={calories} keyboardType="number-pad" onChangeText={setCalories} containerStyle={{ flex: 1.3 }} suffix="kcal" />
            <Field label="Protein" value={protein} keyboardType="decimal-pad" onChangeText={setProtein} containerStyle={{ flex: 1 }} suffix="g" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Carbs" value={carbs} keyboardType="decimal-pad" onChangeText={setCarbs} containerStyle={{ flex: 1 }} suffix="g" />
            <Field label="Fat" value={fat} keyboardType="decimal-pad" onChangeText={setFat} containerStyle={{ flex: 1 }} suffix="g" />
          </View>
          <Field
            label="Note (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What was in it?"
            maxLength={300}
          />

          {!!error && (
            <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
              <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
            </View>
          )}

          <Button
            label={busy ? 'Saving…' : meal ? 'Save changes' : 'Save meal'}
            onPress={save}
            disabled={busy || !calories.trim()}
            loading={busy}
            full
            size="lg"
            icon={<Check size={17} color={c.white} />}
          />
          {!!photo && (
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <Button label="AI again" onPress={runEstimate} variant="soft" size="sm" style={{ flex: 1 }} icon={<RotateCcw size={14} color={c.ink} />} />
              <Button label="Retake" onPress={takePhoto} variant="ghost" size="sm" style={{ flex: 1 }} />
              <Button label="Gallery" onPress={pickFromGallery} variant="ghost" size="sm" style={{ flex: 1 }} />
            </View>
          )}
        </>
      )}

      {!!error && stage !== 'review' && (
        <View style={{ backgroundColor: c.dangerSoft, borderRadius: 13, padding: 12 }}>
          <T variant="meta" style={{ color: c.dangerInk }}>{error}</T>
        </View>
      )}
    </>
  );
}

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 13, padding: 10, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <T variant="caption" tone="muted">{label}</T>
      </View>
      <T variant="bodyStrong">{value}g</T>
    </View>
  );
}

function FoodSource({ value, onChange, penalty }: { value: boolean; onChange: (value: boolean) => void; penalty: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 9 }}>
      <SourceKey
        active={!value}
        title="Home-cooked"
        hint="Counts for the quest"
        icon={<CookingPot size={18} color={!value ? c.primary : c.muted} />}
        onPress={() => onChange(false)}
      />
      <SourceKey
        active={value}
        title="Outside food"
        hint={penalty ? `−${penalty} pts` : 'No penalty'}
        icon={<Store size={18} color={value ? c.warningInk : c.muted} />}
        onPress={() => onChange(true)}
        tone="warning"
      />
    </View>
  );
}

function PickOption({
  icon, soft, title, hint, onPress, disabled
}: {
  icon: ReactNode;
  soft: string;
  title: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1.5, borderColor: c.line }}>
        <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">{title}</T>
          <T variant="meta" tone="muted">{hint}</T>
        </View>
        <ChevronRight size={18} color={c.faint} />
      </View>
    </PressableScale>
  );
}

function SourceKey({
  active, title, hint, icon, onPress, tone
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: ReactNode;
  onPress: () => void;
  tone?: 'warning';
}) {
  const color = tone === 'warning' ? c.warning : c.primary;
  const soft = tone === 'warning' ? c.warningSoft : c.primarySoft;
  return (
    <PressableScale onPress={onPress} style={{ flex: 1 }}>
      <View style={{
        padding: 13,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: active ? color : c.line,
        backgroundColor: active ? soft : c.surface,
        gap: 6
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {icon}
        </View>
        <T variant="bodyStrong">{title}</T>
        <T variant="caption" tone={active && tone === 'warning' ? 'warning' : 'muted'}>{hint}</T>
      </View>
    </PressableScale>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
      <T variant="caption" style={{ color: c.primaryPressed }}>{label}</T>
      <T variant="bodyStrong" style={{ color: c.primaryPressed }}>{value}g</T>
    </View>
  );
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
