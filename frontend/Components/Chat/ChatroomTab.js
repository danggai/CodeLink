import React, { Component } from 'react';
import { StyleSheet, FlatList, Text, View, Alert, TouchableOpacity, TextInput, ToastAndroid } from 'react-native';
import { ListItem, Left, Body, Right, Thumbnail,Icon, Spinner} from 'native-base';

import Fabs from './ChatPopup/Fabs'
import SearchBar from './ChatPopup/SearchBar'
import CreateChatroom from './ChatPopup/CreateChatroom'
import SearchedChatrooms from './ChatPopup/SearchedChatrooms'

import * as SQLite from 'expo-sqlite';
const db = SQLite.openDatabase('db.db');

export default class ChatroomTab extends Component {
    static navigationOptions = {
        tabBarIcon: ({tintColor}) => (
            <Icon name='chatboxes' style={{color: "#FFE400"}}/>
        ),
        header: null,
    }
    constructor(props) {
        super(props);
        this.token = '',
        this.email = '',
        this.state = {
            fabActive : false,
            myLanguage : '',
            myNickname: '',
            favoriteHolder: [],
            arrayHolder: [],
            searcharrayHolder: [],
            suggestedRoom: [],
            searchBarDisplay: 'none',
            createCRDisplay: 'none',
            searchCRDisplay: 'none',
            spinnerOpacity: 1,
        }
    }

    componentWillMount() {
        db.transaction( tx => {
            tx.executeSql(
                'SELECT * FROM token',
                [],
                (_, { rows: { _array }  }) => { 
                    this.token = _array[0].access_token;
                    this.email = _array[0].user_email;
                },
                (_,error) => console.error(error)
            )
            tx.executeSql(
                'SELECT * FROM userInfo',
                [],
                (_, { rows: { _array }  }) => { 
                    this.state.myLanguage = _array[0].language;
                    this.state.myNickname = _array[0].nickname;
                },
                (_,error) => console.error(error)
            )
        },(error) => console.error(error))
        this.crList_reload()
    }

    crList_reload = () => {
        this.state.favoriteHolder.splice(0,100)
        this.state.arrayHolder.splice(0,100)
        db.transaction( tx => {
            tx.executeSql(
                'SELECT * FROM crList',
                [],
                (_, { rows: { _array }  }) => {
                    for(var i=0;i<_array.length;i++)
                    {
                        newItem = {
                            cr_name: _array[i].cr_name,
                            cr_id: _array[i].cr_id,
                            interest: {
                                section: _array[i].section,
                                group: _array[i]._group
                            },
                            memNum: _array[i].memNum,
                            lastMessage: _array[i].lastMessage,
                            lastTime: _array[i].lastTime,
                            favorite: _array[i].favorite
                        }
                        if (_array[i].favorite == 1){
                            this.setState({favoriteHolder: [...this.state.favoriteHolder, newItem]})
                        } else {
                            this.setState({arrayHolder: [...this.state.arrayHolder, newItem]})
                        }
                    }
                    this.setState({spinnerOpacity: 0})
                },
                (_,error) => console.error(error)
            )
        },(error) => console.error(error))
    }

    insertArrayHolder = (cr_name, cr_id, interest, memNum) => {       // 새로운 방을 arrayholder이나 DB에 넣는 함수
        newItem = {
            cr_name: cr_name,
            cr_id: cr_id,
            interest: interest,
            memNum: memNum
        }
        db.transaction( tx => {
            tx.executeSql(
                'INSERT INTO crList (cr_id, cr_name, section, _group, memNum) VALUES (?,?,?,?,?);',
                [cr_id, cr_name, interest.section, interest.group, memNum],
                null,
                (_,error) => console.error(error)
            )
        },(error) => console.error(error));
        this.setState({arrayHolder: [...this.state.arrayHolder, newItem]})
    }

    _onPressSuggestCRFab = () => {
        this.setState({spinnerOpacity: 1});
        var url = 'http://101.101.160.185:3000/chatroom/recommend';
        fetch(url, {
            method: 'GET',
            headers: new Headers({
            'Content-Type' : 'application/json',
            'x-access-token': this.token
            })
        }).then(response => response.json())
        .catch(error => console.error('Error: ', error))
        .then(responseJson => {
            console.log(responseJson)
            if(responseJson._id == undefined) {
                ToastAndroid.show("No chat room found to suit your interests.", ToastAndroid.SHORT)
            } else {
                newItem = {
                    cr_name: responseJson.name,
                    cr_id: responseJson._id,
                    interest: responseJson.interest,
                    //memNum: responseJson.participants.length
                }
                this.setState({suggestedRoom: newItem})
            }
            this.setState({spinnerOpacity: 0})
        })
    }

    _joinCR = (new_room) => {
        db.transaction( tx => {
            tx.executeSql(
                'SELECT * FROM crList WHERE cr_id = ?;',
                [new_room.cr_id],
                (_, { rows: { _array }  }) => {
                    {if(_array.length != 0) {
                        ToastAndroid.show('You already join this room.', ToastAndroid.SHORT);
                    } else {
                        var url = 'http://101.101.160.185:3000/chatroom/entrance/'+new_room.cr_id;
                        fetch(url, {
                            method: 'POST',
                            headers: new Headers({
                            'Content-Type': 'application/json',
                            'x-access-token': this.token
                            }),
                        }).then(response => response.json())
                        .catch(error => console.error('Error: ', error))
                        .then(responseJson=>{
                            this.insertArrayHolder(new_room.cr_name, new_room.cr_id, new_room.interest, new_room.memNum)
                            ToastAndroid.show('Chat room join complete.', ToastAndroid.SHORT);
                            this._switchSearchCR('none')
                        })
                    }}
                },
                (_,error) => console.error(error)
            )
        },(error) => console.error(error));
    }

    _onPressSuggestedCR = (newRoom) => {
        this._joinCR(newRoom)
        this.setState({suggestedRoom: []})
    }

    exitChatRoom = (cr_id) => { // 방 나가기
        var url = 'http://101.101.160.185:3000/chatroom/exit/'+cr_id;
        fetch(url, {
            method: 'POST',
            headers: new Headers({
            'Content-Type' : 'application/json',
            'token' : 'token',
            'x-access-token': this.token
            })
        }).then(response => response.json())
        .catch(error => console.error('Error: ', error))
        this.setState(prevState => {
            const index = prevState.arrayHolder.findIndex(holder => holder.cr_id === cr_id);
            prevState.arrayHolder.splice(index, 1);
            return ({
                arrayHolder: [...prevState.arrayHolder]
            })
        })
        db.transaction( tx => {
            tx.executeSql(
                'DELETE FROM crList WHERE cr_id = ?;',
                [cr_id],
                null,
                (_,error) => console.error(error)
            )
        },(error) => console.error(error));
    }

    _longPressChatroom = (cr_id) => {  // 채팅방 꾹 누르면
        Alert.alert(
            'Exit?',
            'Press the OK button to exit the chat room.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {text: 'OK', onPress: () => {
                    this.exitChatRoom(cr_id);
                }},
            ],
            {cancelable: false},
        );
    }

    _onPressChatroom = (item) => {
        this.props.navigation.navigate('Chatroom', {
            cr_name: item.cr_name,
            cr_id: item.cr_id,
            memNum: item.memNum,
            myEmail: this.email,
            myNickname: this.state.myNickname,
            myLanguage: this.state.myLanguage,
            favorite: item.favorite,
            crList_reload: this.crList_reload()
        });
    }

    FlatListItemSeparator = () => {
        return (
            <View style={{ height: 1, width: "100%" }}/>
        );
    }

    _onPressSearch = (keyword) => {
        if (keyword ==  '') {
            ToastAndroid.show('Please input keyword.', ToastAndroid.SHORT)
            return
        }
        this.state.searcharrayHolder.splice(0,100)
        this.setState({spinnerOpacity: 1});
        var url = 'http://101.101.160.185:3000/chatroom/search/'+keyword;
        fetch(url, {
            method: 'GET',
            headers: new Headers({
            'Content-Type' : 'application/json',
            'token': 'token',
            })
        }).then(response => response.json())
        .catch(error => console.error('Error: ', error))
        .then(responseJson => {
            console.log(responseJson)
            if (responseJson.message == "no search chatroom") {
                ToastAndroid.show('No rooms searched by this keyword.', ToastAndroid.SHORT);
            } else {
                for(var i=0;i<responseJson.length;i++)
                {
                    newItem = {
                        cr_name: responseJson[i].name,
                        cr_id: responseJson[i]._id,
                        interest: responseJson[i].interest
                    }
                    this.setState({searcharrayHolder: [...this.state.searcharrayHolder, newItem]})
                }
                this.setState({
                    searchCRDisplay: 'flex',
                    searchBarDisplay: 'none',
                })
            }
            this.setState({spinnerOpacity: 0})
        })
    }

    _onPressFabs = () => {
        this.setState({fabActive: !this.state.fabActive})
    }

    _switchSearchCR = (display) => {
        this.setState({searchCRDisplay: display, fabActive: false})
    }

    _onPressSearchBarFab = (display) => {
        this.setState({searchBarDisplay: display, fabActive: false})
    }

    _onPressCreateCRFab = (display) => {
        this.setState({createCRDisplay: display, fabActive: false})
    }

    render() {
        return (
            <View style={styles.container}>
                <View style={styles.header}></View>
                {/*=========flatlist 부분===========*/}
                <View style ={{width: '100%', backgroundColor: '#00d500'}}>
                    <Text style = {{fontSize : 16, margin : 15, fontWeight: 'bold', color :"#fff"}}>My Chatroom</Text>
                </View>
                <FlatList
                    data={[...this.state.favoriteHolder, ...this.state.arrayHolder]}
                    height= '100%'
                    width='100%'
                    keyExtractor = {(item, index) => String(index)}
                    ItemSeparatorComponent={this.FlatListItemSeparator}
                    renderItem={({ item }) =>(
                        <ListItem avatar
                            activeOpacity={0.5}
                            onLongPress={() => this._longPressChatroom(item.cr_id)}
                            onPress={() => this._onPressChatroom(item)}
                            key={item.cr_id}>
                            <Left style={{justifyContent: 'center'}}>
                                {item.interest.section == 'Foods'
                                    ? (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/foods.jpg')}/>)
                                    : item.interest.section == 'Games'
                                        ? (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/games.jpg')}/>)
                                        : (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/sports.jpg')}/>)}
                                {item.favorite==1
                                    ?(<Icon name="md-star" style={{width: 34, position : 'absolute', top: 2, left: -9, fontSize: 26, color: '#eec600'}}/>)
                                    :(null)}
                            </Left>
                            <Body>
                                <Text style={{fontSize: 16, fontWeight: 'bold',}}>{item.cr_name}</Text>
                                <Text style={{fontSize: 10, color: '#333'}}>  #{item.interest.section}  #{item.interest.group}</Text>
                                <Text style={{fontSize: 13, width: '80%', height: 18}}>  {item.lastMessage!=null 
                                    ? (item.lastMessage)
                                    : ('No message')}
                                </Text>
                            </Body>
                            <Right style={{justifyContent: 'space-between', alignItems:'flex-end'}}>
                                <Icon name='md-people' style={{fontSize: 16, color: '#333'}}>
                                    <Text style={{fontSize: 14, color: '#333'}}> {item.memNum}</Text>
                                </Icon>
                                <Text style={{fontSize: 12}}>{item.lastTime!=null ?
                                    (item.lastTime.toString().substr(16, 5))
                                    :null}
                                </Text>
                            </Right>
                        </ListItem>
                    )}
                />
                <View style ={{width: '100%', backgroundColor: '#9cf'}}>
                    <Text style = {{fontSize : 16, margin : 15, fontWeight: 'bold', color :"#fff"}}>Chatroom Suggest</Text>
                </View>
                <View style={{width: '100%', height: 80}}>
                {this.state.suggestedRoom.cr_id == undefined
                    ? (<Text style={{color: '#333', fontSize: 16, padding: 30}}>No room suggested yet.</Text>)
                    : (<ListItem avatar
                        activeOpacity={0.5}
                        onPress={() => this._onPressSuggestedCR(this.state.suggestedRoom)}
                        key={this.state.suggestedRoom.cr_id}>
                        <Left style={{justifyContent: 'center'}}>
                            {this.state.suggestedRoom.interest.section == 'Foods'
                                ? (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/foods.jpg')}/>)
                                : this.state.suggestedRoom.interest.section == 'Games'
                                    ? (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/games.jpg')}/>)
                                    : (<Thumbnail style={{width: 50, height: 50, borderRadius: 15}} source={require('../../assets/cr_thumbnail/sports.jpg')}/>)}
                            {this.state.suggestedRoom.favorite==1
                                ?(<Icon name="md-star" style={{width: 34, position : 'absolute', top: 2, left: -9, fontSize: 26, color: '#eec600'}}/>)
                                :(null)}
                        </Left>
                        <Body>
                            <Text style={{fontSize: 16, fontWeight: 'bold',}}>{this.state.suggestedRoom.cr_name}</Text>
                            <Text style={{fontSize: 10, color: '#333'}}>  #{this.state.suggestedRoom.interest.section}  #{this.state.suggestedRoom.interest.group}</Text>
                            <Text style={{fontSize: 13}}>  {this.state.suggestedRoom.lastMessage!=null 
                                ? (item.lastMessage)
                                : ('Resent message 1hour ago')}
                            </Text>
                        </Body>
                        <Right style={{justifyContent: 'flex-start', alignItems:'flex-end'}}>
                            <Icon name='md-people' style={{fontSize: 16, color: '#333'}}>
                                <Text style={{fontSize: 14, color: '#333'}}> {this.state.suggestedRoom.memNum}</Text>
                            </Icon>
                        </Right>
                    </ListItem>)
                }
                </View>
                <SearchBar display={this.state.searchBarDisplay}
                    displayChange={this._onPressSearchBarFab}
                    onPressSearch={this._onPressSearch}/>
                <Fabs active={this.state.fabActive}
                    onPressCreate={this._onPressCreateCRFab}
                    onPressSearch={this._onPressSearchBarFab}
                    onPressSuggest={this._onPressSuggestCRFab}
                    onPressFabs={this._onPressFabs}/>
                <SearchedChatrooms token={this.token}
                    array={this.state.searcharrayHolder}
                    pushNewRoom={this.insertArrayHolder}
                    _onPressChatroom={this._joinCR}
                    displayChange={this._switchSearchCR}
                    display={this.state.searchCRDisplay}/>
                <CreateChatroom token={this.token}
                    pushNewRoom={this.insertArrayHolder}
                    displayChange={this._onPressCreateCRFab}
                    display={this.state.createCRDisplay}/>
                <Spinner size={80} style={{opacity: this.state.spinnerOpacity, flex: 4, position: "absolute", bottom: '43%'}}color='#ccc'/>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container : {
        width: '100%',
        height: '100%',
        justifyContent : 'flex-start',
        alignItems : 'center',
        backgroundColor : '#fff'
    },
    header: {
        flexDirection : "row",
        width:'100%',
        height: 24,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    item : {
        flexDirection : 'row',
        padding : 10,
        justifyContent : 'flex-start',
        borderWidth : 1, 
        borderRadius: 7,
        borderColor : '#333',
        backgroundColor: '#fff',
    },
    thumbnail: {
        justifyContent : 'center',
        alignItems: 'center',
    },
})
