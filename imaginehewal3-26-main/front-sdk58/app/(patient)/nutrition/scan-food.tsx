// app/(patient)/nutrition/scan-food.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../../constants/theme';
import api from '../../../services/api';
import { imagePart } from '../../../services/upload';
import { ActivityIndicator, Image, Ionicons, LinearGradient, SafeAreaView, StatusBar, Text, TouchableOpacity, View } from '../../../components/themed';

const { width } = Dimensions.get('window');

export default function ScanFoodScreen() {
  const router = useRouter();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });
      
      if (photo) {
        setScanning(false);
        setCapturedImage(photo.uri);
        analyzeFood(photo.uri);
      }
    } catch (error) {
      setScanning(false);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      analyzeFood(result.assets[0].uri);
    }
  };

  const analyzeFood = async (uri: string) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      const up = await imagePart(uri);
      formData.append('file', up.part, up.name);
      formData.append('meal_type', 'snack'); // Default to snack for scanning

      const result = await api.analyzeMeal(formData);
      
      Alert.alert(
        'Food Detected',
        `We detected: ${result.detected_food}\n\nCalories: ${result.nutrients.calories}\nProtein: ${result.nutrients.protein}g\nCarbs: ${result.nutrients.carbs}g\nFat: ${result.nutrients.fat}g`,
        [
          { text: 'Retake', style: 'cancel', onPress: () => setCapturedImage(null) },
          { 
            text: 'Log Food', 
            onPress: () => logDetectedFood(result, uri)
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Analysis Failed', error.message || 'Could not analyze food image');
      setCapturedImage(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const logDetectedFood = (analysisResult: any, imageUri?: string) => {
    router.push({
      pathname: '/(patient)/nutrition/food-details',
      params: {
        name: analysisResult.detected_food,
        calories: analysisResult.nutrients.calories,
        protein: analysisResult.nutrients.protein,
        carbs: analysisResult.nutrients.carbs,
        fat: analysisResult.nutrients.fat,
        image: imageUri || capturedImage,
        description: analysisResult.description || '',
        vitamins: JSON.stringify(analysisResult.vitamins || []),
        mealType: 'snack', // Default, can be changed in details
      }
    });
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Permission handling
  if (!permission) {
    // Camera permissions are still loading
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {capturedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.analyzingText}>Analyzing Food...</Text>
            </View>
          )}
        </View>
      ) : (
        <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
            style={styles.cameraOverlay}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Food</Text>
                <TouchableOpacity 
                  onPress={toggleCameraFacing} 
                  style={styles.iconButton}
                >
                  <Ionicons name="camera-reverse" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.scannerFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                <Text style={styles.scannerText}>Position food within the frame</Text>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity onPress={handlePickImage} style={styles.galleryButton}>
                  <Ionicons name="images" size={24} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={handleTakePhoto} style={styles.captureButton}>
                  <View style={styles.captureInner} />
                </TouchableOpacity>

                <View style={styles.galleryButtonPlaceholder} />
              </View>
            </SafeAreaView>
          </LinearGradient>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraOverlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerFrame: {
    width: width * 0.8,
    height: width * 0.8,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  scannerText: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
    position: 'absolute',
    bottom: -60,
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButtonPlaceholder: {
    width: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
});
