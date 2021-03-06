import { Component, OnInit} from '@angular/core'; 
import { HttpClient } from '@angular/common/http';
import { map } from'rxjs/operators';

import { Label } from 'ng2-charts';
import { AuthService } from '../../../../auth/auth.service';
import { GlobalSensor } from '../../homepage/diagram.model'
import { Line_Bar_Charts, Radar_PolarArea_Chart } from '../../homepage/diagram.class';
import { TestSensorData } from './testSensor.class';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';


@Component({
  selector: 'app-diagram',
  templateUrl: './diagram.page.html',
  styleUrls: ['./diagram.page.scss']
})

export class DiagramPage implements OnInit {

  public state = 'not-working';

  //l'id du patient
  public patient_id;

  //l'objet qui se charge de tester les donnees des differents capteurs
  public testSensorData: TestSensorData;

  //la date actuelle 
  public actualDate: Date;

  //le jour choisit, il est initie au jour actuel en debut, c'est un indice
  public day;

  //le boutton de recharge
  public isFetching: boolean = true;

  /*
    les donnees issus du capteur de temperature sous forme d'objet contenant deux tableaux
    le premier represente les differentes prelevements de temperature et l'autre represente 
    leur temps de prelevement
    remarque: les indices des tableaux indique le jour de la semaine :
    0 -> dimanche, 
    1 -> lundi, 
    ....,
    6 -> samedi
  */
  public globalSensor: GlobalSensor = {};

  //le tableau contenant tous les donnees prelevees par les differents capteurs
  public globalData: number[][];

  //les labels du diagramme global
  public globalLabels: Label[];

  //les heures de prelevement des autres diagrammes pendant une semaine
  public labels : Label[][];

  //les heures du prelevement du jour actuel ou bien du jour choisit
  public currentDayLabels: Label[];

  //le diagramme global contenant toutes les differents donnees issus des differents capteurs
  public globalChart: Line_Bar_Charts;
  
  //le diagramme de temperature
  public temperatureChart: Line_Bar_Charts;

  //le diagramme de glucose
  public glucoseChart: Radar_PolarArea_Chart;

  //le diagramme de tension arterielle
  public hyperTensionChart: Line_Bar_Charts;
  
  //le diagramme d'oxygenation
  public oxygeneChart: Radar_PolarArea_Chart;
  
  /*
    variable contenant le nombre de pas par temps de prelevement initié au depart a la 
    premiere valeur preleve du jour actuel
  */
  public nombrePas: number;

  //tableau des differents prelevement de battement de coeur d'un jour
  public currentDayHeartBeats;

  //premier prelevement de battement de coeur dans le jour
  public HeartBeatsValue: number;

  //nombre de pas par jour
  public stepsPerDar: number = 0;

  public shouldIUnsubscribe = false;

  public sexForImg = 'm';

  constructor(private authService: AuthService, private http: HttpClient,
    public toastController: ToastController,
    private route: ActivatedRoute, private router: Router) {

  }
  
  ngOnInit() {
    this.isFetching = true;
    this.actualDate = new Date();
    this.day = this.actualDate.getDay();

    let sub = this.http.get(
      `http://localhost:3000/api/patient/sensorData/${this.authService.userId}`
    )
    .pipe(
      map(responseData => {
        console.log(responseData);
        this.sexForImg = responseData['sex'];
        let mappedResponse = responseData['sensorData'];

        let responseDataLength = 0;
        for(const key in mappedResponse) {
          console.log(key);
          responseDataLength++;

          
          let responseDataNestedObjectLength = 0;
          for(const secondKey in mappedResponse[key]) {
            console.log(secondKey);
            responseDataNestedObjectLength++;
          }

          if(responseDataNestedObjectLength < 2) {
            this.shouldIUnsubscribe = true;
            break;
          }
          
            
        }
        
        if(responseDataLength < 7) {
          this.shouldIUnsubscribe = true;
          return;
        }
        else
          return mappedResponse;
        }
      )
    )
    .subscribe(sensorData => {

      if(this.shouldIUnsubscribe) {
        this.presentToast();
        sub.unsubscribe();
        return;
      }


      this.globalSensor = sensorData;

      for(let i = 0; i < this.globalSensor.dates[this.day].length; i++) {
        this.globalSensor.dates[this.day][i] = this.globalSensor.dates[this.day][i].substring(11, 16);
      }

      this.labels = this.globalSensor.dates;

      console.log(this.globalSensor);
      console.log(this.labels);

      this.testSensorData = new TestSensorData();
      
      this.nombrePas = this.globalSensor.steps.values[this.day][0];
      this.currentDayHeartBeats = this.globalSensor.heartbeat.values[this.day];
      this.HeartBeatsValue = this.currentDayHeartBeats[0];
      this.stepsPerDar = this.calculateTotalSteps();

      this.globalData = [
        this.globalSensor.temperature.values[this.day],
        this.globalSensor.glucose.values[this.day],
        this.globalSensor.bloodPressure.values[this.day],
        this.globalSensor.oxygen.values[this.day],
        this.globalSensor.heartbeat.values[this.day],
        this.globalSensor.steps.values[this.day],
      ];

      this.currentDayLabels = this.labels[this.day]


      console.log(this.currentDayLabels);

      this.globalChart = new Line_Bar_Charts("Global", this.globalData, [
          "temperature in C°", 
          "hypertension in mmHg", 
          "oxygen in %",
          "heartbeats in bmp", 
          "glucose in g/L", 
          "steps per day",
        ]
      );
      this.temperatureChart = new Line_Bar_Charts(
        "Temperature in C°", //son titre
        this.globalSensor.temperature.values[this.day] //les donnees des differents prelevements
      );
      this.glucoseChart = new Radar_PolarArea_Chart(
        "Glucose level in g/L",
        this.globalSensor.glucose.values[this.day]
      );

      this.hyperTensionChart = new Line_Bar_Charts(
        "Hyper tension in mmHg",
        this.globalSensor.bloodPressure.values[this.day]
      );

      this.oxygeneChart = new Radar_PolarArea_Chart(
        "Oxygenation in %",
        this.globalSensor.oxygen.values[this.day]
      );

      this.globalLabels = ["1","2","3","4"]

      this.isFetching = false;

    }, error => {
      this.presentToast();
      console.log(error);
    });

    
      
  }

  //modifier les donnes de tous les diagrammes en cas de changement de jour
  changeData(jour: number) {

    this.globalChart.setGlobalData([
      this.globalSensor.temperature.values[jour],
      this.globalSensor.bloodPressure.values[jour],
      this.globalSensor.oxygen.values[jour],
      this.globalSensor.heartbeat.values[jour],
      this.globalSensor.glucose.values[jour],
      this.globalSensor.steps.values[jour],
    ]);

    this.temperatureChart.setData(
      this.globalSensor.temperature.values[jour],
    );

    this.hyperTensionChart.setData(
      this.globalSensor.bloodPressure.values[jour],
    );

    this.oxygeneChart.setData(
      this.globalSensor.oxygen.values[jour],
    );

    this.glucoseChart.setData(
      this.globalSensor.glucose.values[jour],
    );
    
    this.HeartBeatsValue = this.globalSensor.heartbeat.values[jour][0];
    this.nombrePas = this.globalSensor.steps.values[jour][0];
    this.currentDayLabels = this.labels[jour];
  }

  //calcul du nombre total de pas dans le jour
  calculateTotalSteps() {

    var stepsTotalSum = 0;
    for(var i = 0; i < this.globalSensor.steps.values[this.day].length; i++)
      stepsTotalSum += this.globalSensor.steps.values[this.day][i];
    return stepsTotalSum;
  }

  //calcul du total de nombre de pas jusqu'au prelevement choisi
  displaySteps(prelevtime: number, jour: number) {
    var stepsSum = 0;
    for (var i = 0; i <= prelevtime; i++) stepsSum += this.globalSensor.steps.values[jour][i];
    this.nombrePas = stepsSum;
  }

  //mise a jour du nombre de pas en cas de changement de jour 
  displayHeartBeats(prelevTime: number, jour: string) {
    this.HeartBeatsValue = this.globalSensor.heartbeat.values[jour][prelevTime];
  }

  async presentToast() {
    const toast = await this.toastController.create({
      message: 'The data is not complete or have an incorrect form, checkout the server status and the database.',
      duration: 4000
    });
    toast.present();
  }
}



