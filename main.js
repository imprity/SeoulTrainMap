import { Hour } from './Hour.js';
import { IN_OUT, WEEK_TAG, Course, StationVisit, Train, Station, Branch } from './TrainObjects.js';
import { loadCsv, toCsvString } from './csvFunctions.js'
import { LineColors } from './LineColors.js'
import { UIButton, UISlider } from './UIs.js'
import './node_modules/jszip/dist/jszip.js'

let PARENT_DIV;
let CANVAS;
let GEO_BACKGROUND;
let GRAPH_BACKGROUND;
let STATIONS = [];
let STATION_DISPLAYERS = [];
let CONN_DISPLAYERS = [];
let TRAINS = [];
let TRAIN_DISPLAYERS = [];
let TIME_SLIDER;
let BRANCH_LINES = [];
let TIME_VIEWER
let TIME_MULTIPLIER = 1.0;

let IN_GRAPH_MODE = false;
let GEO_TO_GRAPH_INTERP = 0; // 0 is map view, 1 is graph view

let zip = new JSZip();


/*
sunday schedule from 05:00:00 to 24:30:30
saturday schedule from 05:00:00 to 24:30:30
weekday schedule from 05:00:00 to 24:47:00*/
let sundayStart = new Hour('05:00:00');
let sundayEnd = new Hour('24:30:30');
let saturdayStart = new Hour('05:00:00');
let saturdayEnd = new Hour('24:30:30');
let weekdayStart = new Hour('05:00:00');
let weekdayEnd = new Hour('24:47:00');

let currentWeek = WEEK_TAG.SATURDAY;
let currentSecond = weekdayStart.toSeconds();

/*
    !!! WARNING BACKGROUND IMAGE IS LAID OUT THUS !!! (also canvas in general)
    ----- x
    |
    |
    y
    dont' get confused with station geo location which is laid out like this
    y
    |
    |
    ----- x
*/
let posXMinPixel = 405;
let posXMaxPixel = 618
let posYMinPixel = 266;
let posYMaxPixel = 806;

let graphImagePixelSizeX = 672.18;
let graphImagePixelSizeY = 409.59;

let graphPosXMinPixel = 69.882;
let graphPosXMaxPixel = 602.294;
let graphPosYMinPixel = 54.529;
let graphPosYMaxPixel = 328.412;

let imagePixelSize = 1024;

let posXMin = 126.6170898;
let posXMax = 127.2038706;
let posYMin = 36.7692218;
let posYMax = 37.947954;

let WIDTH = 0;
let HEIGHT = 0

let zoomScale = 1;

function TrainDisplayer(_train) {
    this.train = _train;
    this.currCourse = undefined;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.circle = new paper.Path.Circle(new paper.Point(0, 0), 0.7);
    this.circle.fillColor = 'white';
}

TrainDisplayer.prototype.update = function () {
    this.currCourse = this.train.courses.find(c => c.week_tag == currentWeek);
    if (typeof (this.currCourse) != 'undefined') {
        if (currentSecond >= this.currCourse.earliestTime.toSeconds() && currentSecond <= this.currCourse.latestTime.toSeconds()) {

            this.SetVisible(true);

            if (this.currCourse.earliestTime.toSeconds() == currentSecond) {
                let toGo = codeToStationDisplayer(this.currCourse.originStation);
                this.x = toGo.x;
                this.y = toGo.y;
                this.circle.position.x = this.x;
                this.circle.position.y = this.y;
            }
            else if (this.currCourse.latestTime.toSeconds() == currentSecond) {
                let toGo = codeToStationDisplayer(this.currCourse.destStation);
                this.x = toGo.x;
                this.y = toGo.y;
                this.circle.position.x = this.x;
                this.circle.position.y = this.y;
            } else {
                let index = 0;
                for (; index < this.currCourse.stationVisits.length; index++) {
                    if (this.currCourse.stationVisits[index].arriveTime.toSeconds() > currentSecond) {
                        break;
                    }
                }

                let prevStation = this.currCourse.stationVisits[index - 1];
                let nextStation = this.currCourse.stationVisits[index]

                ///////////////////////////////////////////////////////////////////
                // below is the special edge case for line number 2 which is loop//
                ///////////////////////////////////////////////////////////////////
                if (IN_GRAPH_MODE && ((prevStation.stationCode == "0235" && nextStation.stationCode == "0234") || (prevStation.stationCode == "0234" && nextStation.stationCode == "0235")))
                    this.SetVisible(false);
                //////////////////////////////////////////////////////////////////////
                // below is the special edge case for line number 6 which has a loop//
                /////////////////////////////////////////////////////////////////////
                if (IN_GRAPH_MODE && ((prevStation.stationCode == "2614" && nextStation.stationCode == "2613") || (prevStation.stationCode == "2613" && nextStation.stationCode == "2614")))
                    this.SetVisible(false);

                else {
                    let interp = nextStation.arriveTime.toSeconds() - prevStation.leftTime.toSeconds()
                    interp = (currentSecond - prevStation.leftTime.toSeconds()) / interp;
                    let pos = interpolateStation(prevStation.stationCode, nextStation.stationCode, interp);

                    this.x = pos.x;
                    this.y = pos.y;
                    this.circle.position.x = this.x;
                    this.circle.position.y = this.y;
                    this.circle.strokeColor = LineColors[this.currCourse.lineNum - 1];
                    this.circle.strokeWidth = 0.3;
                }
            }
        }
        else {
            this.SetVisible(false);
        }
    }
    else {
        this.SetVisible(false);
    }

    // important!!
    // this line is here to keep track of the current scale
    //this.circle.scale(zoomDelta);
}

TrainDisplayer.prototype.SetVisible = function (on) {
    if (on) {
        this.active = true;
        this.circle.visible = true;
    } else {
        this.active = false;
        this.circle.visible = false;
    }
}
function ConnetionDisplayer(_stationDisplayer1, _stationDisplayer2) {
    this.stationDisplay1 = _stationDisplayer1;
    this.stationDisplay2 = _stationDisplayer2;
    this.color = this.stationDisplay1.color;
    this.line = new paper.Path();
    this.line.strokeColor = this.color;
    this.line.strokeWidth = 0.3;
    this.line.add(new paper.Point(this.stationDisplay1.x, this.stationDisplay1.y));
    this.line.add(new paper.Point(this.stationDisplay2.x, this.stationDisplay2.y));
    paper.project.activeLayer.insertChild(2, this.line)
}

ConnetionDisplayer.prototype.UpdatePositionAndScale = function () {
    if (
        IN_GRAPH_MODE && ((this.stationDisplay1.atGraphEnd && this.stationDisplay2.atGraphEnd) ||

            ///////////////////////////////////////////////////////////////////
            // below is the special edge case for line number 2 which is loop//
            ///////////////////////////////////////////////////////////////////

            (this.stationDisplay1.station.stationCode == "0235" && this.stationDisplay2.station.stationCode == "0234") ||
            (this.stationDisplay1.station.stationCode == "0234" && this.stationDisplay2.station.stationCode == "0235"))
    )
        this.line.visible = false;
    else
        this.line.visible = true;
    this.line.segments[0].point.x = this.stationDisplay1.x;
    this.line.segments[0].point.y = this.stationDisplay1.y;
    this.line.segments[1].point.x = this.stationDisplay2.x;
    this.line.segments[1].point.y = this.stationDisplay2.y;
    this.line.strokeWidth = 0.3;
}

function StationDisplayer(station) {
    this.station = station;
    let where = geoLocationToBackgroundPos(this.station.xCoord, this.station.yCoord);

    this.x = where.x;
    this.y = where.y;

    this.geoLocationX = where.x;
    this.geoLocationY = where.y;

    this.graphLocationX = 0;
    this.graphLocationY = 0;

    this.atGraphEnd = false;

    this.color = LineColors[this.station.line - 1];
    this.circle = new paper.Path.Circle(new paper.Point(this.x, this.y), 0.3);
    this.circle.fillColor = new paper.Color(this.color);
    this.name = new paper.PointText(new paper.Point(this.x, this.y - 1));
    this.name.justification = 'center';
    this.name.content = this.station.stationName;
    this.name.visible = false;
    this.name.fontSize = 0.5
    this.name.fillColor = this.color;
    this.name.fillColor.brightness *= 0.6;
}
StationDisplayer.prototype.UpdatePositionAndScale = function () {
    let where = {
        x: 0,
        y: 0
    }

    let geoLocation = geoLocationToBackgroundPos(this.station.xCoord, this.station.yCoord);
    let graphLocation = graphLocationToBackgroundPos(this.graphLocationX, this.graphLocationY);

    where.x = map(GEO_TO_GRAPH_INTERP, 0, 1, geoLocation.x, graphLocation.x);
    where.y = map(GEO_TO_GRAPH_INTERP, 0, 1, geoLocation.y, graphLocation.y);

    this.x = where.x;
    this.y = where.y;
    this.circle.position = new paper.Point(this.x, this.y);
    this.name.point = new paper.Point(this.x, this.y - 1);
    if (zoomScale > 10)
        this.name.visible = true;
    else
        this.name.visible = false;
}

window.onload = async function () {

    let trainDatas = await loadTrainJsonData(displayLoadingProgress);
    TRAINS = trainDatas;
    TRAINS.forEach(train => {
        train.courses.forEach(course => {
            let earlyTime = new Hour();
            let lateTime = new Hour();
            earlyTime.copy(course.earliestTime);
            lateTime.copy(course.latestTime);
            course.earliestTime = earlyTime;
            course.latestTime = lateTime;
            course.stationVisits.forEach(visit => {
                let arriveTime = new Hour();
                let leftTime = new Hour();
                arriveTime.copy(visit.arriveTime);
                leftTime.copy(visit.leftTime);
                visit.arriveTime = arriveTime;
                visit.leftTime = leftTime;
            })
        })
    })

    let csvStationLocationData = await loadCsv('./station location info.csv');
    let connectionData = await fetch('./stationConnections.json');
    let stationConnections = await connectionData.json();

    //build stations from csv data;
    for (let i = 0; i < csvStationLocationData[0].length; i++) {
        let stationToPush = new Station();
        stationToPush.stationCode = csvStationLocationData[0][i];
        stationToPush.stationName = csvStationLocationData[1][i];
        stationToPush.stationNameEng = csvStationLocationData[2][i];
        stationToPush.line = parseInt(csvStationLocationData[3][i][1]);
        stationToPush.xCoord = parseFloat(csvStationLocationData[5][i]);
        stationToPush.yCoord = parseFloat(csvStationLocationData[6][i]);
        STATIONS.push(stationToPush);
    }

    //fill up the statio Connections;
    for (let i = 0; i < 8; i++) {
        let connections = stationConnections[i];
        connections.forEach(connection => {
            let station1 = codeToStation(connection[0]);
            let station2 = codeToStation(connection[1]);

            if (station1.connectedStations.findIndex(c => c == station2.stationCode) < 0)
                station1.connectedStations.push(station2.stationCode);
            else
                console.warn('station is connected to it self');
            if (station2.connectedStations.findIndex(c => c == station1.stationCode) < 0)
                station2.connectedStations.push(station1.stationCode);
            else
                console.warn('station is connected to it self');
        })
    }

    PARENT_DIV = window.document.createElement('div');
    PARENT_DIV.style.margin = 0 + 'px'
    PARENT_DIV.style.border = 0 + 'px'
    PARENT_DIV.style.padding = 0 + 'px'
    window.document.body.appendChild(PARENT_DIV);

    CANVAS = window.document.createElement('canvas');
    CANVAS.style.margin = '0px';
    CANVAS.style.border = '0px';
    CANVAS.style.padding = '0px';
    PARENT_DIV.appendChild(CANVAS);
    paper.setup(CANVAS);
    onResize();

    GEO_BACKGROUND = new paper.Raster('./raster-cors.jpg');
    GEO_BACKGROUND.opacity = 0.1;
    GEO_BACKGROUND.applyMatrix = true;
    GEO_BACKGROUND.position = paper.view.center;

    GEO_BACKGROUND.onLoad = function () {

        GRAPH_BACKGROUND = new paper.Raster('./graph background.svg');
        GRAPH_BACKGROUND.opacity = 0;

        GRAPH_BACKGROUND.onLoad = function () {

            GRAPH_BACKGROUND.bounds.center = GEO_BACKGROUND.bounds.center;

            STATIONS.forEach(station => {
                STATION_DISPLAYERS.push(new StationDisplayer(station));
            })
            for (let i = 0; i < 8; i++) {
                let connections = stationConnections[i];
                connections.forEach(connection => {
                    let display1 = codeToStationDisplayer(connection[0]);
                    let display2 = codeToStationDisplayer(connection[1]);
                    CONN_DISPLAYERS.push(new ConnetionDisplayer(display1, display2));
                })
            }

            let seoulLocation = geoLocationToBackgroundPos(126.9725546, 37.5571595);
            zoom(3.0, seoulLocation.x, seoulLocation.y);

            TRAINS.forEach(train => {
                let displayer = new TrainDisplayer(train);
                TRAIN_DISPLAYERS.push(displayer);
                displayer.update();
            })

            //build branch from line 1 to 8;
            BRANCH_LINES.push(buildBranch(codeToStation("1408"), codeToStation("1407"))) // line 1 신창 to 온양온천
            BRANCH_LINES.push(buildBranch(codeToStation("0235"), codeToStation("0236"))) // line 2 문래 to 영등포구청
            BRANCH_LINES.push(buildBranch(codeToStation("1958"), codeToStation("1957"))) // line 3 대화 to 주엽
            BRANCH_LINES.push(buildBranch(codeToStation("1762"), codeToStation("1761"))) // line 4 오이도 to 정왕
            BRANCH_LINES.push(buildBranch(codeToStation("2511"), codeToStation("2512"))) // line 5 방화 to 개화산
            BRANCH_LINES.push(buildBranch(codeToStation("2613"), codeToStation("2612"))) // line 6 불광 to 역촌
            BRANCH_LINES.push(buildBranch(codeToStation("2761"), codeToStation("2760"))) // line 7 부평구청 to 굴포천
            BRANCH_LINES.push(buildBranch(codeToStation("2811"), codeToStation("2812"))) // line 8 암사 to 천호


            let branchLength = [];

            let getBranchLength = function (stations) {
                let lengthToReturn = 0;
                for (let i = 0; i < stations.length - 1; i++) {
                    lengthToReturn += getDistInKm(stations[i].xCoord, stations[i].yCoord, stations[i + 1].xCoord, stations[i + 1].yCoord);
                }
                return lengthToReturn;
            }

            BRANCH_LINES.forEach(branches => {
                let totalLength = 0;

                let branchLoop = function (parentBranch, startingPoint) {
                    let lengthToAdd
                    if (parentBranch.parentBranch === null)
                        lengthToAdd = getBranchLength(parentBranch.stations);
                    else
                        lengthToAdd = getBranchLength(parentBranch.stations.slice(1));
                    if (lengthToAdd + startingPoint > 0)
                        totalLength += lengthToAdd + startingPoint;

                    parentBranch.children.forEach(child => {
                        let startingStation = child.stations[0];
                        let stationIndexInParent = parentBranch.stations.findIndex(station => station === startingStation);

                        let startingPos = -getBranchLength(parentBranch.stations.slice(stationIndexInParent + 1)) + startingPoint;
                        branchLoop(child, startingPos);
                    })
                }

                branchLoop(branches[0], 0);

                branchLength.push(totalLength);
            })

            let longestLength = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < branchLength.length; i++) {
                longestLength = Math.max(longestLength, branchLength[i]);
            }

            let yInterval = (graphPosYMaxPixel - graphPosYMinPixel) / (BRANCH_LINES.length + 1);

            for (let i = 0; i < BRANCH_LINES.length; i++) {
                let branches = BRANCH_LINES[i];
                let yPos = graphPosYMinPixel + yInterval * (i + 1);

                let branchLoop = function (_branch, startingPos) {
                    let startinIndex = 0;

                    if (_branch.parentBranch === null)
                        startinIndex = 0;
                    else
                        startinIndex = 1;

                    let prevDist = startingPos.x;

                    for (let j = startinIndex; j < _branch.stations.length - 1; j++) {

                        let display = codeToStationDisplayer(_branch.stations[j].stationCode);
                        display.graphLocationX = map(prevDist, 0, longestLength, graphPosXMinPixel, graphPosXMaxPixel);
                        display.graphLocationY = startingPos.y;

                        if (j == 0)
                            display.atGraphEnd = true;

                        prevDist += getDistInKm(_branch.stations[j].xCoord, _branch.stations[j].yCoord, _branch.stations[j + 1].xCoord, _branch.stations[j + 1].yCoord);
                    }

                    // set the display for last station;
                    let display = codeToStationDisplayer(_branch.stations[_branch.stations.length - 1].stationCode);
                    display.graphLocationX = map(prevDist, 0, longestLength, graphPosXMinPixel, graphPosXMaxPixel);
                    display.graphLocationY = startingPos.y;
                    // mark the display as the end
                    display.atGraphEnd = true;

                    _branch.children.forEach(child => {
                        let childStartingPos = {
                            x: 0,
                            y: 0
                        }
                        childStartingPos.x = startingPos.x;
                        childStartingPos.y = startingPos.y;

                        let stationIndexInParent = _branch.stations.findIndex(station => { return station === child.stations[0] });
                        childStartingPos.x += getBranchLength(_branch.stations.slice(0, stationIndexInParent + 1));
                        childStartingPos.y += yInterval / 3;
                        branchLoop(child, childStartingPos);
                    })

                }
                branchLoop(branches[0], { x: 0, y: yPos });
            }

            TIME_VIEWER = document.createElement('p');
            TIME_VIEWER.style.position = 'absolute';
            TIME_VIEWER.style.bottom = 40 + 'px';
            TIME_VIEWER.style.left = 30 + 'px';
            TIME_VIEWER.innerText = dayToKorString() + " " + Hour.fromSeconds(currentSecond).toString();
            document.body.appendChild(TIME_VIEWER);

            // adding ui elements
            TIME_SLIDER = new UISlider(PARENT_DIV, 0, 1, 20, 10, event => {
                switch (currentWeek) {
                    case WEEK_TAG.SUNDAY:
                        currentSecond = map(event.target.value, 0, 1, sundayStart.toSeconds(), sundayEnd.toSeconds());
                        break;
                    case WEEK_TAG.SATURDAY:
                        currentSecond = map(event.target.value, 0, 1, saturdayStart.toSeconds(), saturdayEnd.toSeconds());
                        break;
                    case WEEK_TAG.WEEKDAY:
                        currentSecond = map(event.target.value, 0, 1, weekdayStart.toSeconds(), weekdayEnd.toSeconds());
                        break;
                }
                TIME_VIEWER.innerText = dayToKorString() + " " + Hour.fromSeconds(currentSecond).toString();
            });

            TIME_SLIDER.slider.style.top = "";
            TIME_SLIDER.slider.style.bottom = 30 + 'px';
            TIME_SLIDER.slider.style.width = 130 + 'px';

            new UIButton(PARENT_DIV, 10, 10, '일요일', () => { currentWeek = WEEK_TAG.SUNDAY; });
            new UIButton(PARENT_DIV, 80, 10, '토요일', () => { currentWeek = WEEK_TAG.SATURDAY; });
            new UIButton(PARENT_DIV, 150, 10, '평일', () => { currentWeek = WEEK_TAG.WEEKDAY; });
            let timeOutId;
            let changeButton = new UIButton(PARENT_DIV, 10, 50, '그래프로 보기', () => {
                clearTimeout(timeOutId)
                if (IN_GRAPH_MODE) {
                    timeOutId = setInterval(() => {
                        GEO_TO_GRAPH_INTERP -= 0.05;
                        onTranstion();
                        if (GEO_TO_GRAPH_INTERP < 0) {
                            GEO_TO_GRAPH_INTERP = 0;
                            clearTimeout(timeOutId);
                        }
                    }, 10)
                }
                else {
                    timeOutId = setInterval(() => {
                        GEO_TO_GRAPH_INTERP += 0.05;
                        onTranstion();
                        if (GEO_TO_GRAPH_INTERP > 1) {
                            GEO_TO_GRAPH_INTERP = 1;
                            clearTimeout(timeOutId);
                        }
                    }, 10)
                }
                IN_GRAPH_MODE = !IN_GRAPH_MODE;
                if (IN_GRAPH_MODE)
                    changeButton.button.innerText = '지도로 보기'
                else
                    changeButton.button.innerText = '그래프로 보기'
            })

            let multiplierController = document.createElement('input');
            multiplierController.type = "number";
            multiplierController.value = 1;
            multiplierController.style.position = 'absolute';
            multiplierController.style.left = 210 + 'px';
            multiplierController.style.bottom = 30 + 'px';
            multiplierController.style.width = 50 + 'px';
            multiplierController.step = 'any';
            multiplierController.min = 0;
            multiplierController.addEventListener('input', event => {
                let toSet = parseFloat(event.target.value);
                if (toSet < 0 || isNaN(toSet)) { toSet = 0 };
                TIME_MULTIPLIER = toSet;
                multiplierController.value = toSet;
            })
            document.body.appendChild(multiplierController);

            let multiplierControllerLabel = document.createElement('label');
            multiplierControllerLabel.innerText = '배속'
            multiplierControllerLabel.style.position = 'absolute';
            multiplierControllerLabel.style.bottom = 30 + 'px';
            multiplierControllerLabel.style.left = 170 + 'px';
            multiplierControllerLabel.htmlFor = multiplierController;
            document.body.appendChild(multiplierControllerLabel);

            //////////////////////////////////
            //add event listeners
            //////////////////////////////////
            paper.view.onFrame = function (event) {
                addTime(event.delta * TIME_MULTIPLIER);
                TRAIN_DISPLAYERS.forEach(displayer => displayer.update());
            }

            window.addEventListener('resize', event => {
                onResize();
            })

            let listener = new CanvasListener(CANVAS);

            listener.onpointerdrag = (event) => {
                let deltaX = event.x - event.prevX;
                let deltaY = event.y - event.prevY;
                paper.view.translate(deltaX / zoomScale, deltaY / zoomScale);
            };

            listener.onwheel = (event)=>{
                let xformed = clinetCoordinateToPaperCoodinate(event.x, event.y);
                zoom(1.0 - event.wheelDelta * 0.001, xformed.x, xformed.y);
            }

            listener.onpinch = (event)=>{
                let xformed = clinetCoordinateToPaperCoodinate(event.pinchX, event.pinchY);
                zoom(event.pinchSize / event.prevPinchSize, xformed.x, xformed.y);
            }
        }
    }
}

function onTranstion() {
    STATION_DISPLAYERS.forEach(displayer => { displayer.UpdatePositionAndScale() });
    CONN_DISPLAYERS.forEach(displayer => { displayer.UpdatePositionAndScale() });
    GEO_BACKGROUND.opacity = 0.1 * (1 - GEO_TO_GRAPH_INTERP);
    GRAPH_BACKGROUND.opacity = GEO_TO_GRAPH_INTERP;
}

function addTime(delta) {
    currentSecond += delta;
    let maxSecond = 0;
    let minSecond = 0;
    switch (currentWeek) {
        case WEEK_TAG.SUNDAY:
            maxSecond = sundayEnd.toSeconds();
            minSecond = sundayStart.toSeconds();
            break;
        case WEEK_TAG.SATURDAY:
            maxSecond = saturdayEnd.toSeconds();
            minSecond = saturdayStart.toSeconds();
            break;
        case WEEK_TAG.WEEKDAY:
            maxSecond = weekdayEnd.toSeconds();
            minSecond = weekdayStart.toSeconds();
            break;
    }

    if (currentSecond > maxSecond)
        currentSecond = minSecond;
    else if (currentSecond < minSecond)
        currentSecond = maxSecond;
    TIME_SLIDER.setValue(map(currentSecond, minSecond, maxSecond, 0, 1));
    TIME_VIEWER.innerText = dayToKorString() + " " + Hour.fromSeconds(currentSecond).toString();
}

let dayToKorString = function () {
    switch (currentWeek) {
        case WEEK_TAG.SATURDAY:
            return '토요일';
            break;
        case WEEK_TAG.SUNDAY:
            return '일요일';
            break;
        case WEEK_TAG.WEEKDAY:
            return '평일';
            break;
    }
}

function zoom(delta, x, y) {
    paper.view.scale(delta, new paper.Point(x, y));
    zoomScale = paper.view.zoom;
    STATION_DISPLAYERS.forEach(displayer => displayer.UpdatePositionAndScale());
}


function onResize() {
    WIDTH = window.document.documentElement.clientWidth;
    HEIGHT = window.document.documentElement.clientHeight;
    CANVAS.width = WIDTH;
    CANVAS.height = HEIGHT;
    paper.view.viewSize = new paper.Size(WIDTH, HEIGHT);
    STATION_DISPLAYERS.forEach(displayer => {
        displayer.UpdatePositionAndScale();
    })
}

let loadingText = undefined;
function displayLoadingProgress(progress) {
    if (typeof (loadingText) == 'undefined') {
        loadingText = document.createElement('p');
        window.document.body.appendChild(loadingText);
    }
    loadingText.innerHTML = `HI   ${(progress * 100).toFixed(0)}% loaded :)`
    if (progress >= 1) {
        console.log('done loading');
        loadingText.remove();
    }
}

async function loadTrainJsonData(progressCb) {
    let response;
    try {
        response = await fetch('./train export.zip');
    }
    catch (err) {
        throw new Error(err);
    }
    if (!response.ok)
        throw new Error(response.statusText);

    let contentLength = response.headers.get('Content-Length');
    let receivedLength = 0;
    let reader = response.body.getReader();
    let chunks = [];

    while (true) {
        let done;
        let value;
        try {
            let reading = await reader.read();
            done = reading.done;
            value = reading.value;
        }
        catch {
            throw new Error('something went wrong while parsing data');
        }

        if (done)
            break;

        chunks.push(value);

        receivedLength += value.length;
        progressCb(receivedLength / contentLength);
    }

    let chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
    }

    let trainZip = await zip.loadAsync(chunksAll);
    let jsonText = await trainZip.file('train export.json').async('string');

    return JSON.parse(jsonText);
}

function geoLocationToBackgroundPos(x, y) {
    let toReturn = {
        x: 0,
        y: 0
    }
    toReturn.x = map(x, posXMin, posXMax, posXMinPixel, posXMaxPixel);
    toReturn.y = map(y, posYMax, posYMin, posYMinPixel, posYMaxPixel);
    toReturn.x /= imagePixelSize;
    toReturn.y /= imagePixelSize;
    toReturn.x = GEO_BACKGROUND.bounds.x + toReturn.x * GEO_BACKGROUND.bounds.width;
    toReturn.y = GEO_BACKGROUND.bounds.y + toReturn.y * GEO_BACKGROUND.bounds.height;
    return toReturn;
}

function geoBackgroundPosToLocation(x, y) {
    let toReturn = {
        x: 0,
        y: 0,
    }
    toReturn.x -= GEO_BACKGROUND.bounds.x;
    toReturn.y -= GEO_BACKGROUND.bounds.y;
    toReturn.x = map(x, posXMinPixel, posXMaxPixel, posXMin, posXMax)
    toReturn.y = map(y, posYMinPixel, posYMaxPixel, posYMin, posYMax);
    return toReturn;
}

function graphLocationToBackgroundPos(x, y) {
    let toReturn = {
        x: x,
        y: y,
    }
    toReturn.x /= graphImagePixelSizeX;
    toReturn.y /= graphImagePixelSizeY;
    toReturn.x = GRAPH_BACKGROUND.bounds.x + toReturn.x * GRAPH_BACKGROUND.bounds.width;
    toReturn.y = GRAPH_BACKGROUND.bounds.y + toReturn.y * GRAPH_BACKGROUND.bounds.height;
    return toReturn;
}

// straight from processing lol
function map(value,
    istart,
    istop,
    ostart,
    ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}

let codeToName = function (code) {
    return codeToStation(code).stationName;
}

let codeToStation = function (code) {
    return STATIONS.find(s => { return s.stationCode == code });
}

let codeToLineNum = function (code) {
    return codeToStation(code).line;
}

let codeToStationDisplayer = function (code) {
    return STATION_DISPLAYERS.find(displayer => code == displayer.station.stationCode)
}

function pathToStation(current, next) {

    if (typeof (current) == 'string')
        current = codeToStation(current);
    if (typeof (next) == 'string')
        next = codeToStation(next);

    if (current.stationCode == next.stationCode)
        return [current.stationCode];

    if (current.connectedStations.findIndex(c => c == next.stationCode) >= 0)
        return [current.stationCode, next.stationCode];

    let searchLoop = function (station, stationToFind, visitedStationCodes = []) {
        let results = [];
        visitedStationCodes.push(station.stationCode);
        for (let i = 0; i < station.connectedStations.length; i++) {
            if (visitedStationCodes.findIndex(c => c == station.connectedStations[i]) < 0) {

                if (station.connectedStations[i] == stationToFind) {
                    visitedStationCodes.push(stationToFind);
                    return visitedStationCodes;
                }
                else {
                    results.push(searchLoop(codeToStation(station.connectedStations[i]), stationToFind, visitedStationCodes.slice()));
                }
            }
        }
        let minLength = Number.MAX_SAFE_INTEGER;
        let indexAt = -1;
        for (let i = 0; i < results.length; i++) {
            if (results[i] != null) {
                if (results[i].length < minLength) {
                    minLength = results[i].length;
                    indexAt = i;
                }
            }
        }
        if (indexAt >= 0)
            return results[indexAt];
        return null;
    }

    return searchLoop(current, next.stationCode);
}

function clinetCoordinateToPaperCoodinate(x, y){
    let transformed = paper.view.matrix.inverseTransform(new paper.Point(x, y));
    return transformed;
}

function interpolateStation(code1, code2, value) {
    if (value < 0)
        value = 0;
    if (value > 1)
        value = 1;
    let toReturn = {
        x: 0,
        y: 0
    }
    if (code1 == code2) {
        let display = codeToStationDisplayer(code1);
        toReturn.x = display.x;
        toReturn.y = display.y;
        return toReturn;
    }

    let displays = [];
    let codes = pathToStation(code1, code2);
    if (codes == null)
        throw new Error('could not find path');
    let lengths = [];
    let totalLength = 0;
    codes.forEach(code => {
        displays.push(codeToStationDisplayer(code));
    })

    for (let i = 1; i < displays.length; i++) {
        let dist = getDist(displays[i].x, displays[i].y, displays[i - 1].x, displays[i - 1].y)
        lengths.push(dist);
        totalLength += dist;
    }
    let targetLength = totalLength * value;
    let index = 0;
    for (; index < lengths.length; index++) {
        targetLength -= lengths[index];
        if (targetLength < 0)
            break;
    }
    if (index > displays.length - 2)
        index = displays.length - 2;
    targetLength = totalLength * value;
    for (let i = 0; i < index; i++) {
        targetLength -= lengths[i];
    }
    let interpLocal = targetLength / lengths[index];

    toReturn.x = map(interpLocal, 0, 1, displays[index].x, displays[index + 1].x);
    toReturn.y = map(interpLocal, 0, 1, displays[index].y, displays[index + 1].y);
    return toReturn;
}

function getDist(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getDistInKm(x1, y1, x2, y2) {
    x1 *= Math.PI / 180;
    y1 *= Math.PI / 180;
    x2 *= Math.PI / 180;
    y2 *= Math.PI / 180;
    let latitudeDelta = y2 - y1;
    let latitudeMedian = (y1 + y2) / 2.0;
    let longtitudeDelta = x2 - x1;
    return 6371.009 * Math.sqrt(latitudeDelta * latitudeDelta + Math.pow(Math.cos(latitudeMedian) * longtitudeDelta, 2));
}

function buildBranch(startStation, nextStation) {
    let stationArrs = [];
    let visitedStations = [];

    let buildLoop = function (currStation, currArr) {
        visitedStations.push(currStation.stationCode);
        currArr.push(currStation);

        let nextStations = [];

        currStation.connectedStations.forEach(code => {
            let index = visitedStations.findIndex(c => { return c == code });
            if (index < 0)
                nextStations.push(codeToStation(code));
        })

        if (nextStations.length == 0) {
            stationArrs.push(currArr);
        }
        else if (nextStations.length == 1) {
            buildLoop(nextStations[0], currArr);
        }
        else {
            stationArrs.push(currArr);
            for (let i = 0; i < nextStations.length; i++) {
                let newArr = [];
                newArr.push(currStation);
                buildLoop(nextStations[i], newArr);
            }
        }
    }

    visitedStations.push(startStation.stationCode);

    let newArr = [];
    newArr.push(startStation)
    buildLoop(nextStation, newArr);

    let branches = [];

    let connectionLoop = function (currBranch) {
        let candidates = [];
        stationArrs.forEach(array => {
            if (currBranch.stations[currBranch.stations.length - 1] === array[0])
                candidates.push(array);
        })
        candidates.sort((a, b) => { return b.length - a.length });
        if (candidates.length == 0) {
            branches.push(currBranch);
        }
        else {
            currBranch.stations = currBranch.stations.concat(candidates[0].slice(1));
            connectionLoop(currBranch);
            for (let i = 1; i < candidates.length; i++) {
                let newBranch = new Branch();
                newBranch.stations = candidates[i];
                newBranch.parentBranch = currBranch;
                currBranch.children.push(newBranch);

                connectionLoop(newBranch);
            }
        }
    }

    let startingBranch = new Branch();
    startingBranch.stations = stationArrs[0];
    connectionLoop(startingBranch);

    return branches;
}