// AttachmentModal.js (in components/chat folder)
import React from "react"
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native"
import { Ionicon } from "../../components/ui/AppIcons"

const AttachmentModal = ({ visible, onClose, onPickImage, onTakePhoto, onPickDocument }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Share</Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity style={styles.option} onPress={onPickImage}>
                  <View style={[styles.iconContainer, { backgroundColor: "#4CAF50" }]}>
                    <Ionicon name="image" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.option} onPress={onTakePhoto}>
                  <View style={[styles.iconContainer, { backgroundColor: "#2196F3" }]}>
                    <Ionicon name="camera" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.option} onPress={onPickDocument}>
                  <View style={[styles.iconContainer, { backgroundColor: "#FF9800" }]}>
                    <Ionicon name="document" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.optionText}>Document</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  option: {
    alignItems: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  optionText: {
    fontSize: 14,
    color: "#333",
  },
  closeButton: {
    backgroundColor: "#F0F0F0",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#128C7E",
    fontWeight: "bold",
  },
})

export default AttachmentModal
