export const checkDeviceAvailability = async () => {
  const devices = {
    camera: false,
    microphone: false
  };

  try {
    // Check camera
    const videoDevices = await navigator.mediaDevices.enumerateDevices();
    devices.camera = videoDevices.some(device => device.kind === 'videoinput');

    // Check microphone
    const audioDevices = await navigator.mediaDevices.enumerateDevices();
    devices.microphone = audioDevices.some(device => device.kind === 'audioinput');

    return devices;
  } catch (error) {
    console.error('Error checking device availability:', error);
    return devices;
  }
};

export const requestDevicePermissions = async () => {
  try {
    // Request camera and microphone permissions
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    // Stop the stream immediately after getting permissions
    stream.getTracks().forEach(track => track.stop());
    
    return true;
  } catch (error) {
    console.error('Error requesting device permissions:', error);
    return false;
  }
}; 