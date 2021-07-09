import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-first',
  templateUrl: './first.component.html',
  styleUrls: ['./first.component.less']
})
export class FirstComponent implements OnInit {
  title = 'child-angular11';
  constructor() { }

  ngOnInit(): void {
  }

}
