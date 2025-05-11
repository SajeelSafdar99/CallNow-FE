import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AttachmentModal = ({ visible, onClose, onPickImage, onTakePhoto, onPickDocument, theme }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Attach Media
              </Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[styles.option, { backgroundColor: theme.background }]}
                  onPress={onTakePhoto}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
                    <Ionicons name="camera" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.optionText, { color: theme.text }]}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, { backgroundColor: theme.background }]}
                  onPress={onPickImage}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#2196F3' }]}>
                    <Ionicons name="images" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.optionText, { color: theme.text }]}>Photos & Videos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, { backgroundColor: theme.background }]}
                  onPress={onPickDocument}
                >
                  <View style={[styles.iconContainer, { backgroundColor: '#FF9800' }]}>
                    <Ionicons name="document" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.optionText, { color: theme.text }]}>Documents</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.background }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelText, { color: theme.primary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  option: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    width: '30%',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionText: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
  },
  cancelButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AttachmentModal;
