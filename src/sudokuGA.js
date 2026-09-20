export class SudokuGA {
  constructor(puzzle) {
    this.puzzle = puzzle.map(row => [...row]);
    this.population = [];
    this.populationSize = 100;
    this.mutationRate = 0.1;
    this.generation = 0;
    this.bestFitness = 0;
    this.populationHistory = [];
    this.initializePopulation();
  }

  initializePopulation() {
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.createIndividual());
    }
    this.evaluateFitness();
  }

  createIndividual() {
    const individual = this.puzzle.map(row => [...row]);
    for (let i = 0; i < 9; i++) {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const filled = individual[i].map((val, idx) => val !== 0 ? val : null);
      const emptyIndices = individual[i]
        .map((val, idx) => val === 0 ? idx : null)
        .filter(idx => idx !== null);

      numbers.sort(() => Math.random() - 0.5);
      let numIdx = 0;
      emptyIndices.forEach(idx => {
        individual[i][idx] = numbers[numIdx++];
      });
    }
    return individual;
  }

  evaluateFitness() {
    this.population.forEach((individual, idx) => {
      individual.fitness = this.calculateFitness(individual);
    });
    this.population.sort((a, b) => b.fitness - a.fitness);
    this.bestFitness = this.population[0].fitness;
  }

  calculateFitness(individual) {
    let fitness = 0;

    for (let col = 0; col < 9; col++) {
      const colNums = new Set();
      for (let row = 0; row < 9; row++) {
        colNums.add(individual[row][col]);
      }
      fitness += colNums.size;
    }

    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxCol = 0; boxCol < 3; boxCol++) {
        const boxNums = new Set();
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            boxNums.add(individual[boxRow * 3 + i][boxCol * 3 + j]);
          }
        }
        fitness += boxNums.size;
      }
    }

    return fitness;
  }

  mutate(individual) {
    const mutated = individual.map(row => [...row]);

    for (let row = 0; row < 9; row++) {
      if (Math.random() < this.mutationRate) {
        const emptyIndices = [];
        for (let col = 0; col < 9; col++) {
          if (this.puzzle[row][col] === 0) {
            emptyIndices.push(col);
          }
        }

        if (emptyIndices.length >= 2) {
          const idx1 = Math.floor(Math.random() * emptyIndices.length);
          const idx2 = Math.floor(Math.random() * emptyIndices.length);
          const col1 = emptyIndices[idx1];
          const col2 = emptyIndices[idx2];

          [mutated[row][col1], mutated[row][col2]] = [mutated[row][col2], mutated[row][col1]];
        }
      }
    }

    return mutated;
  }

  evolve() {
    const newPopulation = [];

    newPopulation.push(JSON.parse(JSON.stringify(this.population[0])));

    while (newPopulation.length < this.populationSize) {
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();
      let child = this.crossover(parent1, parent2);
      child = this.mutate(child);
      newPopulation.push(child);
    }

    this.population = newPopulation;
    this.evaluateFitness();
    this.generation++;

    this.populationHistory.push({
      generation: this.generation,
      bestFitness: this.bestFitness,
      avgFitness: this.population.reduce((sum, ind) => sum + ind.fitness, 0) / this.population.length,
      bestIndividual: JSON.parse(JSON.stringify(this.population[0]))
    });
  }

  selectParent() {
    const tournament = [];
    for (let i = 0; i < 3; i++) {
      const randomIdx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[randomIdx]);
    }
    tournament.sort((a, b) => b.fitness - a.fitness);
    return JSON.parse(JSON.stringify(tournament[0]));
  }

  crossover(parent1, parent2) {
    const child = parent1.map(row => [...row]);
    const crossoverPoint = Math.floor(Math.random() * 9);

    for (let i = crossoverPoint; i < 9; i++) {
      child[i] = parent2[i].map(val => val);
    }

    return child;
  }

  isSolved() {
    return this.bestFitness === 243;
  }

  getBestSolution() {
    return this.population[0];
  }
}
