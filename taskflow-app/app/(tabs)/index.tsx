import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.header}>
        <View>
          <Text>Tarefas de Hoje</Text>
        </View>
        <View style={{flex: 1}}/>
        <Pressable style={styles.plusButton} onPress={() => console.log("Botão pressionado!")}>
          <Text style={styles.plusText} >+</Text>
        </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6200EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 36,
  }
});
