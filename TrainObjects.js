const IN_OUT = {
    IN: 1,
    OUT: 2
}

const WEEK_TAG = {
    WEEKDAY: 1,
    SATURDAY: 2,
    SUNDAY: 3
}

function Course(){
    this.lineNum = 0;
    this.in_out = 0
    this.week_tag = 0;
    this.originStation = "";
    this.destStation = "";
    this.stationVisits = [];
    this.earliestTime = null;
    this.latestTime = null;
}

function StationVisit(){
    this.stationCode = "";
    this.leftTime = null;
    this.arriveTime = null;
}

function Station(){
    this.stationCode = "";
    this.stationName = "";
    this.stationNameEng = "";
    this.connectedStations = [];
    this.xCoord = 0.0;
    this.yCoord = 0.0;
    this.line = -1;
}

function Train(){
    this.UUID = 0;
    this.number = "";
    this.courses = [];      
}

function Branch(){
    this.stations = [];
    this.parentBranch = null;
    this.children = [];
}

export {IN_OUT, WEEK_TAG, Course, StationVisit, Train, Station, Branch};