import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Banner, Button, Card, Chip, Screen, ScreenHeader, T, TextField } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { CommunityMe } from '../../../services/api';
import { imagePart } from '../../../services/upload';
import { Image, Ionicons, Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
const MAX_SELLING = 5;                       // a listing can show up to five photos; any other post, one
const CATS = [{ k: 'discussion', label: 'Discussion', hint: 'Ask a question or talk about an issue' }, { k: 'tip', label: 'Tip', hint: 'Share something that helped you' }, { k: 'marketplace', label: 'Sell', hint: 'A health or fitness item' }];

export default function NewPost() {
  const router = useRouter();
  const { group } = useLocalSearchParams<{ group?: string }>();          // set when posting inside an interest group
  const [me, setMe] = useState<CommunityMe | null>(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [cat, setCat] = useState('discussion');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [imgs, setImgs] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.getCommunityMe().then((m) => { setMe(m); setName(m.suggested_name); }).catch((e) => setErr(e.message)); }, []);

  const join = async () => {
    if (!agree) { setErr('Please accept the community rules to continue.'); return; }
    setBusy(true); setErr(null);
    try { setMe(await api.joinCommunity(name.trim() || undefined, true)); } catch (e: any) { setErr(e.message || 'Could not join.'); } finally { setBusy(false); }
  };

  const maxPhotos = cat === 'marketplace' ? MAX_SELLING : 1;
  const room = maxPhotos - imgs.length;
  const chooseCat = (k: string) => { setCat(k); if (k !== 'marketplace') setImgs((x) => x.slice(0, 1)); };          // leaving a listing keeps only the first photo

  const pick = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', camera ? 'Allow camera access to take a photo.' : 'Allow photo access to attach a picture.'); return; }
      if (room <= 0) { setErr(`You can add up to ${maxPhotos} ${maxPhotos === 1 ? 'photo' : 'photos'}.`); return; }
      const res = camera ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ['images'] as any })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ['images'] as any, allowsMultipleSelection: room > 1, selectionLimit: room });
      if (!res.canceled && res.assets?.length) { setErr(null); setImgs((x) => [...x, ...res.assets].slice(0, maxPhotos)); }
    } catch (e: any) { setErr(e.message || 'Could not open the photos.'); }
  };

  const submit = async () => {
    setErr(null);
    if (!body.trim()) { setErr('Write something first.'); return; }
    if (cat === 'marketplace' && (!prodCat || !price.trim())) { setErr('Choose a product type and enter a price.'); return; }
    setBusy(true);
    try {
      const f = new FormData();
      f.append('category', cat); f.append('body', body.trim());
      if (group) f.append('group_key', String(group));
      if (title.trim()) f.append('title', title.trim());
      if (cat === 'marketplace') {
        f.append('product_category', prodCat); f.append('price', price.replace(',', '.'));
        if (phone.trim()) f.append('contact_phone', phone.trim());
      }
      for (const img of imgs.slice(0, maxPhotos)) {
        const { part, name } = await imagePart(img.uri, img.mimeType);               // a real file part: Expo's fetch does not accept the RN {uri,name,type} object
        f.append('files', part, name);
      }
      const p = await api.createPost(f);
      if (p.support_notice) Alert.alert('You are not alone', p.support_notice, [{ text: 'OK', onPress: () => router.back() }]);
      else router.back();
    } catch (e: any) { setErr(e.message || 'Could not post.'); } finally { setBusy(false); }
  };

  return (
    <ProtectedRoute>
      <Screen keyboard header={<ScreenHeader title="New post" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 60 }}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {me && !me.joined ? (
          <Card>
            <T v="heading">Join the community</T>
            <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>Pick a display name. Others see this name, never your email or phone.</T>
            <View style={{ marginTop: 12 }}><TextField label="Display name" value={name} onChangeText={setName} autoCapitalize="none" maxLength={24} /></View>
            <T v="label" style={{ marginTop: 6 }}>Community rules</T>
            {me.rules.map((r) => <T key={r} v="caption" color={C.textSecondary}>• {r}</T>)}
            <Pressable onPress={() => setAgree((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
              <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={24} color={C.primary} /><T v="body" style={{ flex: 1 }}>I agree to the rules</T>
            </Pressable>
            <Button title="Join and continue" onPress={join} loading={busy} />
          </Card>
        ) : me ? (
          <View style={{ gap: 16 }}>
            <View>
              <T v="label" style={{ marginBottom: 8 }}>What is this about?</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>{CATS.filter((c) => !group || c.k !== 'marketplace').map((c) => <Chip key={c.k} label={c.label} selected={cat === c.k} onPress={() => chooseCat(c.k)} />)}</View>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{CATS.find((c) => c.k === cat)!.hint}</T>
            </View>
            <TextField label={cat === 'marketplace' ? 'Item name' : 'Title (optional)'} value={title} onChangeText={setTitle} maxLength={120} />
            <TextField label={cat === 'marketplace' ? 'Describe the item and its condition' : 'Your message'} value={body} onChangeText={setBody} multiline maxLength={2000} style={{ minHeight: 120, textAlignVertical: 'top' }} />
            {cat === 'marketplace' ? (
              <View style={{ gap: 12 }}>
                <View><T v="label" style={{ marginBottom: 8 }}>Product type</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{me.product_categories.map((p) => <Chip key={p} label={p} selected={prodCat === p} onPress={() => setProdCat(p)} />)}</View></View>
                <TextField label="Price (GHS)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                <TextField label="Contact phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" helper="Shown to people who open your listing. Leave empty to be contacted through comments." />
                <Banner tone="info" text="Only health and fitness items for this app's purpose. Medicines, alcohol, tobacco and similar items are not allowed." />
              </View>
            ) : null}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <T v="label">{maxPhotos > 1 ? 'Photos (optional)' : 'Photo (optional)'}</T>
                {maxPhotos > 1 ? <T v="caption" color={imgs.length >= maxPhotos ? C.warning : C.textSecondary}>{imgs.length} of {maxPhotos}</T> : null}
              </View>
              {imgs.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                  {imgs.map((im, k) => (
                    <View key={`${im.uri}-${k}`} style={{ width: maxPhotos > 1 ? 92 : '100%', height: maxPhotos > 1 ? 92 : 200 }}>
                      <Image source={{ uri: im.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" accessibilityLabel={`Selected photo ${k + 1}`} />
                      <Pressable onPress={() => setImgs((x) => x.filter((_, j) => j !== k))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove photo ${k + 1}`}
                        style={{ position: 'absolute', right: 4, top: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              {room > 0 ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title={imgs.length ? 'Add more' : 'Gallery'} icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(false)} />
                  <Button title="Camera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick(true)} />
                </View>
              ) : <T v="caption" color={C.warning}>You have added the most photos allowed. Remove one to add another.</T>}
              <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>JPEG, PNG or WebP, up to 5 MB each. {cat === 'marketplace' ? 'Add up to 5 photos of the item. ' : ''}Do not share photos of other people without permission.</T>
            </View>
            <T v="caption" color={C.textTertiary}>{me.disclaimer}</T>
            <Button title="Post" icon="send" onPress={submit} loading={busy} />
          </View>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
