import {Button, View} from 'react-native';
import { userAuthentication } from '@/database/services/auth';

export default function TestAuth() {
    return (
        <View>
            <Button title='Testar Login' onPress={userAuthentication} />
        </View>
    );
}